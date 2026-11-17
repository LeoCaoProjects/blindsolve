/** Real Auth, REST and Storage boundaries. Disposable localhost stack only. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { base, service, anon, sql, request, jwt } from "./local-provider.mjs";
const users = [],
  feedbackId = randomUUID(),
  objectPath = `${feedbackId}/fixture.png`;
let passed = 0;
const check = (ok, label) => {
  assert.ok(ok, label);
  console.log(`ok ${++passed} - ${label}`);
};
const rpc = (name, token, body = {}) =>
  request(`/rest/v1/rpc/${name}`, token, body);
const report = (token) => rpc("admin_overview", token, { period: "7d" });
const rows = async (table, token, query = "") => {
  const response = await request(
    `/rest/v1/${table}${query}`,
    token,
    undefined,
    "GET",
  );
  return { response, data: await response.json() };
};
const hidden = async (table, token, label) => {
  const { response, data } = await rows(table, token);
  check(!response.ok || (Array.isArray(data) && data.length === 0), label);
};
const storage = (
  path,
  token,
  body,
  method = "POST",
  type = "application/json",
) =>
  fetch(`${base}/storage/v1/${path}`, {
    method,
    headers: {
      apikey: anon,
      Authorization: `Bearer ${token}`,
      "Content-Type": type,
    },
    ...(body === undefined
      ? {}
      : { body: type === "application/json" ? JSON.stringify(body) : body }),
  });
try {
  for (let i = 0; i < 2; i++) {
    const email = `security-contract-${randomUUID()}@example.invalid`,
      password = randomUUID();
    const created = await request("/auth/v1/admin/users", service, {
      email,
      password,
      email_confirm: true,
      user_metadata: {
        is_admin: true,
        role: "admin",
        app_metadata: { role: "admin" },
      },
    });
    assert.equal(created.status, 200);
    const id = (await created.json()).id;
    assert.match(id, /^[0-9a-f-]{36}$/);
    const login = await request("/auth/v1/token?grant_type=password", anon, {
      email,
      password,
    });
    assert.equal(login.status, 200);
    users.push({ id, ...(await login.json()) });
  }
  const [admin, user] = users,
    a = admin.access_token,
    u = user.access_token;
  check(
    (await (await rpc("is_feedback_admin", u)).json()) === false,
    "signup metadata cannot self-promote",
  );
  const changed = await request(
    "/auth/v1/user",
    u,
    { data: { is_admin: true, role: "admin" } },
    "PUT",
  );
  check(
    changed.ok && (await (await rpc("is_feedback_admin", u)).json()) === false,
    "profile/OAuth-style user metadata cannot self-promote",
  );
  check(
    !(
      await request(
        "/auth/v1/user",
        u,
        { app_metadata: { role: "admin" } },
        "PUT",
      )
    ).ok,
    "server app metadata cannot be edited by the user",
  );
  check(
    !(
      await request(
        `/rest/v1/profiles?id=eq.${user.id}`,
        u,
        { is_admin: true },
        "PATCH",
      )
    ).ok,
    "no writable profile Admin flag",
  );
  sql(`insert into public.feedback_admins(user_id) values ('${admin.id}');
    insert into public.feedback(id,user_id,category,message,screenshot_path,screenshot_name) values ('${feedbackId}','${user.id}','general','Synthetic private feedback','${objectPath}','fixture.png');`);
  const solveId = randomUUID(),
    analysisId = randomUUID(),
    schemeId = randomUUID(),
    pairId = randomUUID();
  sql(`insert into public.solves(id,user_id,scramble,intended_state) values ('${solveId}','${admin.id}','R U','{}');
    insert into public.analysis_runs(id,solve_id,input_kind,pipeline_version) values ('${analysisId}','${solveId}','manual','test');
    insert into public.frame_observations(analysis_run_id,timestamp_ms) values ('${analysisId}',0);
    insert into public.timeline_events(analysis_run_id,sequence_no,event_type,evidence,time_start_ms,time_end_ms) values ('${analysisId}',0,'gap','unresolved',0,0);
    insert into public.stage_metrics(analysis_run_id,stage_key) values ('${analysisId}','cross');
    insert into public.lettering_schemes(id,user_id,edge_buffer,corner_buffer) values ('${schemeId}','${admin.id}','UF','UFR');
    insert into public.sticker_labels(scheme_id,user_id,physical_sticker_id,piece_type,token) values ('${schemeId}','${admin.id}','UF','edge','A');
    insert into public.letter_pairs(id,user_id,first_sticker_id,second_sticker_id,first_token,second_token) values ('${pairId}','${admin.id}','UF','UB','A','B');
    insert into public.letter_pair_aliases(pair_id,user_id,mnemonic) values ('${pairId}','${admin.id}','Synthetic word');
    insert into public.bld_solves(user_id,scramble,memo_ms,execution_ms,total_ms,result) values ('${admin.id}','R U',1,1,2,'success');
    insert into public.practice_attempts(user_id,kind,correct,pair_id) values ('${admin.id}','memo',true,'${pairId}');
    insert into public.bld_workspaces(user_id,data) values ('${admin.id}','{}');`);
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ7kAAAAASUVORK5CYII=",
    "base64",
  );
  check(
    (
      await storage(
        `object/feedback-screenshots/${objectPath}`,
        service,
        png,
        "POST",
        "image/png",
      )
    ).ok,
    "private synthetic attachment uploaded",
  );
  for (const [label, token] of [
    ["guest", anon],
    ["normal user", u],
  ]) {
    check(!(await report(token)).ok, `${label}: direct Admin RPC denied`);
    await hidden("feedback", token, `${label}: inbox/attachment paths hidden`);
    await hidden("feedback_admins", token, `${label}: membership table hidden`);
    check(
      !(await request("/rest/v1/feedback_admins", token, { user_id: user.id }))
        .ok,
      `${label}: cannot grant Admin`,
    );
    for (const status of ["reviewing", "planned", "archived", "new"]) {
      await request(
        `/rest/v1/feedback?id=eq.${feedbackId}`,
        token,
        { status, admin_note: "unauthorized" },
        "PATCH",
      );
      check(
        sql(
          `select status||':'||coalesce(admin_note,'') from public.feedback where id='${feedbackId}'`,
        ) === "new:",
        `${label}: ${status}/note mutation denied`,
      );
    }
    await request(
      `/rest/v1/feedback?id=eq.${feedbackId}`,
      token,
      undefined,
      "DELETE",
    );
    check(
      sql(`select count(*) from public.feedback where id='${feedbackId}'`) ===
        "1",
      `${label}: delete denied`,
    );
    check(
      !(
        await request("/rest/v1/feedback", token, {
          category: "general",
          message: "bypass",
        })
      ).ok,
      `${label}: direct submission bypass denied`,
    );
    check(
      !(
        await storage(`object/sign/feedback-screenshots/${objectPath}`, token, {
          expiresIn: 60,
        })
      ).ok,
      `${label}: cannot sign attachment`,
    );
    check(
      !(
        await storage(
          `object/authenticated/feedback-screenshots/${objectPath}`,
          token,
          undefined,
          "GET",
        )
      ).ok,
      `${label}: cannot download attachment`,
    );
    check(
      !(
        await storage(
          `object/feedback-screenshots/${randomUUID()}/test.png`,
          token,
          png,
          "POST",
          "image/png",
        )
      ).ok,
      `${label}: direct upload bypass denied`,
    );
    await storage(
      "object/feedback-screenshots",
      token,
      { prefixes: [objectPath] },
      "DELETE",
    );
    check(
      (
        await storage(`object/sign/feedback-screenshots/${objectPath}`, a, {
          expiresIn: 60,
        })
      ).ok,
      `${label}: attachment delete had no effect`,
    );
    for (const table of [
      "edge_rate_limits",
      "feedback_submission_limits",
      "bld_sync_rate_limits",
    ])
      await hidden(table, token, `${label}: ${table} private`);
    check(
      !(
        await rpc("apply_bld_sync_changes_unserialized", token, {
          changes: [],
          expected_revision: 0,
        })
      ).ok,
      `${label}: private sync implementation denied`,
    );
    check(
      !(
        await rpc("consume_feedback_submission_slot", token, {
          p_fingerprint: "a".repeat(64),
        })
      ).ok,
      `${label}: limiter mutation denied`,
    );
  }
  const download = await storage(
    `object/authenticated/feedback-screenshots/${objectPath}`,
    a,
    undefined,
    "GET",
  );
  check(
    download.ok && Buffer.from(await download.arrayBuffer()).equals(png),
    "Admin downloads exact attachment bytes",
  );
  const removable = randomUUID();
  sql(
    `insert into public.feedback(id,category,message) values ('${removable}','general','Synthetic delete fixture');`,
  );
  check(
    (
      await request(
        `/rest/v1/feedback?id=eq.${removable}`,
        a,
        undefined,
        "DELETE",
      )
    ).ok &&
      sql(`select count(*) from public.feedback where id='${removable}'`) ===
        "0",
    "Admin permanent delete allowed",
  );
  const beforeResponse = await report(a);
  check(beforeResponse.ok, "live Admin aggregate allowed");
  const before = await beforeResponse.json();
  check(
    (await rows("feedback", a, `?id=eq.${feedbackId}`)).data.length === 1,
    "live Admin reads Feedback",
  );
  for (const status of [
    "reviewing",
    "planned",
    "resolved",
    "archived",
    "new",
  ]) {
    check(
      (
        await request(
          `/rest/v1/feedback?id=eq.${feedbackId}`,
          a,
          { status, admin_note: "Private synthetic note" },
          "PATCH",
        )
      ).ok,
      `Admin ${status}/note allowed`,
    );
    check(
      sql(`select status from public.feedback where id='${feedbackId}'`) ===
        status,
      `Admin ${status} persisted`,
    );
  }
  check(
    !(
      await request(
        `/rest/v1/feedback?id=eq.${feedbackId}`,
        a,
        { admin_note: "x".repeat(10001) },
        "PATCH",
      )
    ).ok,
    "oversized note rejected",
  );
  check(
    !(
      await request(
        `/rest/v1/feedback?id=eq.${feedbackId}`,
        a,
        { status: "';drop table feedback;--" },
        "PATCH",
      )
    ).ok,
    "malformed status rejected",
  );
  for (const body of [
    { period: "';drop table feedback;--" },
    { period: "x".repeat(10000) },
    { period: null },
    { period: "7d", user_id: admin.id },
  ])
    check(
      !(await rpc("admin_overview", a, body)).ok,
      "malformed/oversized/unexpected RPC input denied",
    );
  check(
    !(await rpc("is_feedback_admin", u, { user_id: admin.id })).ok,
    "cannot supply another Admin identity",
  );
  const parts = u.split(".");
  const claims = JSON.parse(Buffer.from(parts[1], "base64url"));
  claims.sub = admin.id;
  parts[1] = Buffer.from(JSON.stringify(claims)).toString("base64url");
  check(
    !(await report(parts.join("."))).ok,
    "tampered identity signature denied",
  );
  check(
    !(await report(jwt("authenticated", admin.id, true))).ok,
    "expired JWT denied",
  );
  check(
    !(await report(jwt("authenticated", admin.id))).ok,
    "sessionless token denied",
  );
  const id = randomUUID();
  const change = {
    kind: "solve",
    record_id: id,
    deleted: false,
    updated_at: new Date().toISOString(),
    payload: { id, result: "dnf", createdAt: new Date().toISOString() },
    user_id: admin.id,
  };
  const apply = (token, changes, revision) =>
    rpc("apply_bld_sync_changes", token, {
      changes,
      expected_revision: revision,
    });
  check(
    (await apply(u, [change], 0)).ok,
    "canonical owner write allowed; supplied owner ignored",
  );
  check((await apply(u, [change], 0)).ok, "identical stale replay is a no-op");
  const after = await (await report(a)).json();
  check(after.solves - before.solves === 1, "replay counted once");
  check(
    after.activeUsers - before.activeUsers === 1,
    "active account deduplicated",
  );
  check(
    !JSON.stringify(after).includes(user.id) &&
      !JSON.stringify(after).includes("@example.invalid"),
    "aggregate contains no identities",
  );
  await hidden(
    "bld_sync_records",
    a,
    "Admin cannot read another owner's raw sync rows",
  );
  const own = await rows("bld_sync_records", u);
  check(
    own.data.every((r) => r.user_id === user.id),
    "record owner comes only from signed identity",
  );
  check(
    !(
      await apply(
        u,
        [{ ...change, payload: { ...change.payload, result: "success" } }],
        0,
      )
    ).ok,
    "stale divergent replay denied",
  );
  check(
    (await apply(u, [{ ...change, deleted: true, payload: null }], 1)).ok,
    "history tombstone accepted",
  );
  check((await apply(u, [change], 2)).ok, "resurrection attempt is a no-op");
  check(
    (await rows("bld_sync_records", u)).data[0].deleted === true,
    "deleted history stays deleted",
  );
  check(
    !(
      await request("/rest/v1/bld_sync_records", u, {
        user_id: admin.id,
        kind: "pair",
        record_id: "AB",
        payload: {},
      })
    ).ok,
    "direct cross-owner write denied",
  );
  for (const changes of [
    [],
    {},
    [{ ...change, kind: "';drop table feedback;--" }],
    [{ ...change, payload: { id: "wrong" } }],
    [{ ...change, payload: { id, oversized: "x".repeat(524289) } }],
  ])
    check(
      !(await apply(u, changes, 2)).ok,
      "malformed/oversized sync batch rejected",
    );
  check(
    (await rows("profiles", u, `?id=eq.${admin.id}`)).data.length === 0,
    "other profile hidden",
  );
  for (const table of [
    "solves",
    "analysis_runs",
    "frame_observations",
    "timeline_events",
    "stage_metrics",
    "solve_details",
    "lettering_schemes",
    "sticker_labels",
    "letter_pairs",
    "letter_pair_aliases",
    "bld_solves",
    "practice_attempts",
    "bld_workspaces",
  ])
    await hidden(table, u, `${table}: no other-owner rows`);
  const malformedId = randomUUID();
  check(
    (
      await apply(
        u,
        [
          {
            ...change,
            record_id: malformedId,
            payload: {
              ...change.payload,
              id: malformedId,
              createdAt: "2026-11-16T00:00:00+99:99",
            },
          },
        ],
        2,
      )
    ).ok,
    "legacy malformed date accepted without changing sync semantics",
  );
  const malformedReport = await report(a);
  check(
    malformedReport.ok &&
      (await malformedReport.json()).undatedSolves === before.undatedSolves + 1,
    "malformed user timezone is excluded without breaking Admin",
  );
  check(
    !(await request("/auth/v1/admin/users", a, undefined, "GET")).ok,
    "Admin browser cannot enumerate Auth users",
  );
  check(
    !(await rpc("record_date", a, { value: "now" })).ok,
    "private helper absent from REST",
  );
  check(!(await report(u)).ok, "switching accounts does not inherit Admin");
  const denyAdmin = async (label) => {
    check(!(await report(a)).ok, `${label}: Overview denied`);
    check(
      (await (await rpc("is_feedback_admin", a)).json()) === false,
      `${label}: shared authorization false`,
    );
    await hidden("feedback", a, `${label}: Feedback denied`);
    await request(
      `/rest/v1/feedback?id=eq.${feedbackId}`,
      a,
      { admin_note: "revoked" },
      "PATCH",
    );
    check(
      sql(`select admin_note from public.feedback where id='${feedbackId}'`) ===
        "Private synthetic note",
      `${label}: note mutation denied`,
    );
    check(
      !(
        await storage(`object/sign/feedback-screenshots/${objectPath}`, a, {
          expiresIn: 60,
        })
      ).ok,
      `${label}: attachment signing denied`,
    );
    await request(
      `/rest/v1/feedback?id=eq.${feedbackId}`,
      a,
      { status: "archived" },
      "PATCH",
    );
    await request(
      `/rest/v1/feedback?id=eq.${feedbackId}`,
      a,
      undefined,
      "DELETE",
    );
    check(
      sql(`select status from public.feedback where id='${feedbackId}'`) ===
        "new",
      `${label}: archive/delete denied`,
    );
  };
  sql(
    `update auth.users set banned_until=now()+interval '1 hour' where id='${admin.id}';`,
  );
  await denyAdmin("banned account");
  sql(
    `update auth.users set banned_until=null,deleted_at=now() where id='${admin.id}';`,
  );
  await denyAdmin("soft-deleted account");
  sql(`update auth.users set deleted_at=null where id='${admin.id}';`);
  sql(`update auth.users set is_anonymous=true where id='${admin.id}';`);
  await denyAdmin("anonymous account with accidental membership");
  sql(`update auth.users set is_anonymous=false where id='${admin.id}';`);
  sql(`delete from public.feedback_admins where user_id='${admin.id}';`);
  await denyAdmin("revoked membership");
  sql(
    `insert into public.feedback_admins(user_id) values ('${admin.id}');update auth.sessions set not_after=now()-interval '1 second' where user_id='${admin.id}';`,
  );
  await denyAdmin("expired live session");
  sql(
    `update auth.sessions set not_after=null where user_id='${admin.id}';delete from auth.sessions where user_id='${admin.id}';`,
  );
  await denyAdmin("revoked live session");
  await request(
    `/auth/v1/admin/users/${admin.id}`,
    service,
    undefined,
    "DELETE",
  );
  await denyAdmin("deleted account");
  console.log(`${passed} provider/security checks passed`);
} finally {
  await storage(
    "object/feedback-screenshots",
    service,
    { prefixes: [objectPath] },
    "DELETE",
  );
  sql(`delete from public.feedback where id='${feedbackId}';`);
  for (const user of users)
    await request(
      `/auth/v1/admin/users/${user.id}`,
      service,
      undefined,
      "DELETE",
    );
}
