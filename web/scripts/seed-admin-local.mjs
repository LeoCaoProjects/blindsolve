/** Synthetic fixtures and a real one-time Auth link for the disposable local stack. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  base,
  service,
  anon,
  sql,
  request,
} from "../tests/infrastructure/local-provider.mjs";
const app = new URL(process.env.LOCAL_APP_URL ?? "http://127.0.0.1:5173");
assert.ok(["127.0.0.1", "localhost"].includes(app.hostname));
assert.equal(app.protocol, "http:");
assert.equal(app.username + app.password, "");
const redirect = new URL("/admin", app).href;
const emails = [
  "admin@blindsolve.example.invalid",
  "solver@blindsolve.example.invalid",
];
const users = [];
for (const [i, email] of emails.entries()) {
  let id = sql(`select id from auth.users where email='${email}';`);
  if (!id) {
    const response = await request("/auth/v1/admin/users", service, {
      email,
      password: randomUUID(),
      email_confirm: true,
      user_metadata: {
        full_name: i === 0 ? "Local test Admin" : "Local test solver",
      },
    });
    assert.equal(response.status, 200);
    id = (await response.json()).id;
  }
  assert.match(id, /^[0-9a-f-]{36}$/);
  users.push(id);
}
const [admin, solver] = users;
sql(`insert into public.feedback_admins(user_id) values ('${admin}') on conflict do nothing;
  insert into public.bld_sync_records(user_id,kind,record_id,payload,deleted,updated_at)
  select '${solver}','solve','d0000000-0000-4000-8000-'||lpad(n::text,12,'0'),
    jsonb_build_object('id','d0000000-0000-4000-8000-'||lpad(n::text,12,'0'),
      'scramble','R U R''','memoMs',12000,'executionMs',18000,'totalMs',30000,
      'result',case when n%5=0 then 'dnf' else 'success' end,
      'edgeMemo','[]'::jsonb,'cornerMemo','[]'::jsonb,'cycleBreaks','{"edges":[],"corners":[]}'::jsonb,
      'createdAt',to_char(now()-make_interval(days=>n%10),'YYYY-MM-DD"T"HH24:MI:SS"Z"')),
    false,now()-make_interval(days=>n%10)
  from generate_series(1,24) n on conflict do nothing;
  insert into public.bld_sync_records(user_id,kind,record_id,payload,deleted,updated_at)
  select '${solver}','attempt','e0000000-0000-4000-8000-'||lpad(n::text,12,'0'),
    jsonb_build_object('id','e0000000-0000-4000-8000-'||lpad(n::text,12,'0'),
      'kind','memo','correct',true,'durationMs',10000,
      'trainingMode',(array['exec','guided','recall','trace','recognition'])[1+n%5],
      'createdAt',to_char(now()-make_interval(days=>n%6),'YYYY-MM-DD"T"HH24:MI:SS"Z"')),
    false,now()-make_interval(days=>n%6)
  from generate_series(1,15) n on conflict do nothing;
  insert into public.feedback(id,category,message,status,admin_note,source_page)
  select ('f0000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
    (array['bug','feature','general'])[1+n%3]::public.feedback_category,
    (array['Synthetic fixture: timer keyboard feedback','Synthetic fixture: Training suggestion','Synthetic fixture: thank you','Synthetic fixture: resolved issue','Synthetic fixture: archived note'])[n],
    (array['new','reviewing','planned','resolved','archived'])[n]::public.feedback_status,
    'Disposable local fixture; safe to edit or delete.','Local test'
  from generate_series(1,5) n on conflict do nothing;`);
const response = await request("/auth/v1/admin/generate_link", service, {
  type: "magiclink",
  email: emails[0],
  redirect_to: redirect,
});
assert.equal(response.status, 200);
const link = (await response.json()).action_link;
assert.equal(new URL(link).origin, base);
assert.equal(new URL(link).searchParams.get("redirect_to"), redirect);
console.log(JSON.stringify({ url: base, anonKey: anon, loginUrl: link }));
