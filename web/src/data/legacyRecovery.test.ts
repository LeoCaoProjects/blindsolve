import { beforeEach, expect, it, vi } from "vitest";
import { loadCloud, loadLegacyRecovery } from "./repository";
import { emptyData } from "./model";

const mock = vi.hoisted(() => ({
  getSession: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
}));
vi.mock("../lib/supabase", () => ({
  supabase: { auth: { getSession: mock.getSession }, from: mock.from, rpc: mock.rpc },
}));

const owner = "owner-a";
const current = { owner, isCurrent: () => true };
const session = (id = owner, token = "token-a") => ({
  data: { session: { user: { id }, access_token: token } },
  error: null,
});
const ok = (data: unknown) => ({ data, error: null });
const denied = { data: null, error: { code: "42501", message: "denied" } };
const attempt = {
  id: "9007199254740993", user_id: owner, pair_id: null, kind: "memo",
  correct: true, accuracy: 0.5, details: '{"unfamiliar":9007199254740997}',
  created_at: "2026-09-25T00:00:00Z",
};
const alias = { id: "9223372036854775807", user_id: owner, pair_id: "physical-id", mnemonic: "word" };

function query(response: unknown) {
  const request = {
    select: vi.fn(() => request),
    eq: vi.fn(() => request),
    order: vi.fn(() => request),
    limit: vi.fn(() => request),
    gt: vi.fn(() => request),
    setHeader: vi.fn(() => request),
    then: (resolve: (result: unknown) => unknown, reject: (error: unknown) => unknown) =>
      Promise.resolve(response).then(resolve, reject),
  };
  return request;
}

beforeEach(() => {
  vi.resetAllMocks();
  mock.getSession.mockResolvedValue(session());
});

it("exports both original source shapes with lossless identity and rereads from the beginning", async () => {
  const first = query(ok([attempt]));
  const next = query(ok([]));
  const aliases = query(ok([alias]));
  mock.from.mockReturnValueOnce(first).mockReturnValueOnce(next)
    .mockReturnValueOnce(aliases).mockReturnValueOnce(query(ok([])));
  const result = await loadLegacyRecovery(current);
  expect(result.tables.map(({ rows }) => rows.map(({ source }) => source))).toEqual([[attempt], [alias]]);
  expect(result.tables.every(({ status, rows }) => status === "complete" && !!rows[0].reason)).toBe(true);
  expect(first.select).toHaveBeenCalledWith("id::text,user_id,pair_id,kind,correct,accuracy,details::text,created_at");
  expect(first.eq).toHaveBeenCalledWith("user_id", owner);
  expect(aliases.eq).toHaveBeenCalledWith("user_id", owner);
  expect(first.setHeader).toHaveBeenCalledWith("Authorization", "Bearer token-a");
  expect(next.gt).toHaveBeenCalledWith("id", attempt.id);
  const second = query(ok([]));
  mock.from.mockReturnValue(second);
  expect((await loadLegacyRecovery(current)).tables.every(({ rows }) => !rows.length)).toBe(true);
  expect(second.gt).not.toHaveBeenCalled();
  expect(mock.rpc).not.toHaveBeenCalled();
});

it("distinguishes a partial page sequence and denied table from an empty successful read", async () => {
  mock.from.mockReturnValueOnce(query(ok([attempt])))
    .mockReturnValueOnce(query(denied)).mockReturnValueOnce(query(denied));
  const { tables } = await loadLegacyRecovery(current);
  expect(tables.map(({ status, rows }) => [status, rows.length])).toEqual([["partial", 1], ["unavailable", 0]]);
  expect(tables.every(({ issue }) => !!issue)).toBe(true);
});

it("preserves owner-verified malformed source and flags the pagination boundary", async () => {
  const malformed = { ...attempt, id: "invalid", details: "unknown raw details" };
  mock.from.mockReturnValueOnce(query(ok([malformed]))).mockReturnValueOnce(query(ok([])));
  const { tables } = await loadLegacyRecovery(current);
  expect(tables[0]).toMatchObject({ status: "partial", rows: [{ source: malformed }] });
});

it("fails closed when the returned owner is missing or different", async () => {
  for (const user_id of [undefined, "owner-b"]) {
    mock.from.mockReturnValueOnce(query(ok([{ ...attempt, user_id }])));
    await expect(loadLegacyRecovery(current)).rejects.toThrow("could not be verified");
  }
});

it.each([["owner-b", "token-b"], [owner, "new-token"]])(
  "discards rows when the session changes in flight (%s, %s)", async (id, token) => {
    mock.getSession.mockResolvedValueOnce(session()).mockResolvedValueOnce(session())
      .mockResolvedValueOnce(session(id, token));
    mock.from.mockReturnValueOnce(query(ok([attempt])));
    await expect(loadLegacyRecovery(current)).rejects.toThrow("session changed");
    expect(mock.from).toHaveBeenCalledTimes(1);
  },
);

it("does not dispatch when the Store generation is already stale", async () => {
  await expect(loadLegacyRecovery({ owner, isCurrent: () => false })).rejects.toThrow("Account changed");
  expect(mock.from).not.toHaveBeenCalled();
});

it("keeps tombstone-only canonical and empty V2 histories ahead of legacy recovery", async () => {
  const id = "7c98f547-4280-44fd-9a01-9a6cdc43152a";
  mock.rpc.mockReturnValueOnce(query(ok({ revision: 7, records: [
    { kind: "attempt", record_id: id, payload: null, deleted: true, updated_at: attempt.created_at },
  ] })));
  const canonical = await loadCloud(current);
  expect(canonical.data.attempts).toEqual([]);
  expect(canonical.tombstones).toEqual({ [`attempt:${id}`]: attempt.created_at });
  expect(mock.rpc).toHaveBeenCalledTimes(1);
  mock.rpc.mockReturnValueOnce(query(ok({ revision: 8, records: [] })))
    .mockReturnValueOnce(query(ok({ revision: 3, data: emptyData() })));
  expect(await loadCloud(current)).toMatchObject({ revision: 8, data: { attempts: [] } });
  expect(mock.rpc).toHaveBeenCalledTimes(2);
  mock.rpc.mockReset();
  mock.rpc.mockReturnValueOnce(query(ok({ revision: 0, records: [] })))
    .mockReturnValueOnce(query(ok({ revision: 3, data: emptyData() })));
  expect(await loadCloud(current)).toMatchObject({ revision: 3, data: { attempts: [] } });
  expect(mock.from).not.toHaveBeenCalled();
});
