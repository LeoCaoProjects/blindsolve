import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  rpc: vi.fn(),
  header: vi.fn(),
}));
vi.mock("../lib/supabase", () => ({
  supabase: { auth: { getSession: mocks.session }, rpc: mocks.rpc },
}));
import { emptyData } from "./model";
import { loadCloud, saveCloudChanges, type SyncChange } from "./repository";
const change: SyncChange = {
  kind: "solve",
  recordId: "8d00ae21-5444-41df-a008-d7bfcdf2f741",
  payload: null,
  deleted: true,
  updatedAt: "2026-11-05T01:00:00Z",
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockResolvedValue({
    data: {
      session: { user: { id: "alice" }, access_token: "synthetic-alice-token" },
    },
  });
  mocks.rpc.mockImplementation(() => ({
    setHeader: mocks.header,
    then: (resolve: (value: unknown) => unknown) =>
      Promise.resolve({ data: 2, error: null }).then(resolve),
  }));
});
it("pins each write to the authenticated owner checked for that batch", async () => {
  await expect(
    saveCloudChanges([change], 1, { owner: "alice", isCurrent: () => true }),
  ).resolves.toBe(2);
  expect(mocks.header).toHaveBeenCalledWith(
    "Authorization",
    "Bearer synthetic-alice-token",
  );
});

it("does not hydrate an old owner from a different authenticated session", async () => {
  mocks.session.mockResolvedValue({
    data: { session: { user: { id: "bob" }, access_token: "synthetic-bob-token" } },
  });
  await expect(
    loadCloud({ owner: "alice", isCurrent: () => true }),
  ).rejects.toThrow("Account changed");
  expect(mocks.rpc).not.toHaveBeenCalled();
});

it("pins the snapshot and workspace fallback to the same checked account", async () => {
  mocks.rpc.mockImplementation((name) => ({
    setHeader: mocks.header,
    then: (resolve: (value: unknown) => unknown) => Promise.resolve({
      data: name === "get_bld_sync_snapshot"
        ? { revision: 0, records: [] }
        : { revision: 1, data: emptyData() },
      error: null,
    }).then(resolve),
  }));
  await expect(loadCloud({ owner: "alice", isCurrent: () => true })).resolves.toMatchObject({ revision: 1 });
  expect(mocks.rpc.mock.calls.map(([name]) => name)).toEqual(["get_bld_sync_snapshot", "get_bld_workspace"]);
  expect(mocks.header.mock.calls).toEqual(Array(2).fill(["Authorization", "Bearer synthetic-alice-token"]));
});

it("discards a late snapshot before falling back after an owner transition", async () => {
  let current = true;
  mocks.rpc.mockImplementationOnce(() => ({
    setHeader: mocks.header,
    then: (resolve: (value: unknown) => unknown) => {
      current = false;
      return Promise.resolve({ data: { revision: 0, records: [] }, error: null }).then(resolve);
    },
  }));
  await expect(loadCloud({ owner: "alice", isCurrent: () => current })).rejects.toThrow("Account changed");
  expect(mocks.rpc).toHaveBeenCalledTimes(1);
});
it("does not send an old owner queue using a different account session", async () => {
  mocks.session.mockResolvedValue({
    data: {
      session: { user: { id: "bob" }, access_token: "synthetic-bob-token" },
    },
  });
  await expect(
    saveCloudChanges([change], 1, { owner: "alice", isCurrent: () => true }),
  ).rejects.toThrow("Account changed");
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("cancels if the owner changes while resolving its session", async () => {
  let current = true;
  mocks.session.mockImplementation(async () => {
    current = false;
    return {
      data: {
        session: {
          user: { id: "alice" },
          access_token: "synthetic-alice-token",
        },
      },
    };
  });
  await expect(
    saveCloudChanges([change], 1, { owner: "alice", isCurrent: () => current }),
  ).rejects.toThrow("Account changed");
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("stops later chunks after an account switch and chains committed revisions", async () => {
  let current = true;
  mocks.rpc.mockImplementationOnce(() => ({
    setHeader: mocks.header,
    then: (resolve: (value: unknown) => unknown) => {
      current = false;
      return Promise.resolve({ data: 2, error: null }).then(resolve);
    },
  }));
  const changes = Array.from({ length: 501 }, (_, index) => ({
    ...change,
    recordId: String(index),
  }));
  await expect(
    saveCloudChanges(changes, 1, { owner: "alice", isCurrent: () => current }),
  ).rejects.toThrow("Account changed");
  expect(mocks.rpc).toHaveBeenCalledTimes(1);
  expect(mocks.rpc.mock.calls[0][1].expected_revision).toBe(1);
});

it("chains revisions across successful chunks", async () => {
  mocks.rpc.mockImplementation((_name, args) => ({
    setHeader: mocks.header,
    then: (resolve: (value: unknown) => unknown) =>
      Promise.resolve({ data: args.expected_revision + 1, error: null }).then(
        resolve,
      ),
  }));
  const changes = Array.from({ length: 501 }, (_, index) => ({
    ...change,
    recordId: String(index),
  }));
  await expect(
    saveCloudChanges(changes, 1, { owner: "alice", isCurrent: () => true }),
  ).resolves.toBe(3);
  expect(mocks.rpc.mock.calls.map((call) => call[1].expected_revision)).toEqual(
    [1, 2],
  );
  expect(mocks.header).toHaveBeenCalledTimes(2);
});

it("replays an acknowledged prefix after a partial failure without duplicating it in a controlled backend", async () => {
  let revision = 1;
  let failTail = true;
  const committed = new Set<string>();
  mocks.rpc.mockImplementation((_name, args) => ({
    setHeader: mocks.header,
    then: (resolve: (value: unknown) => unknown) => {
      const ids: string[] = args.changes.map((row: { record_id: string }) => row.record_id);
      const missing = ids.filter(id => !committed.has(id));
      if (ids.length === 1 && failTail) {
        failTail = false;
        return Promise.resolve({ data: null, error: { message: "mock disconnect" } }).then(resolve);
      }
      if (missing.length) {
        expect(args.expected_revision).toBe(revision);
        missing.forEach(id => committed.add(id));
        revision++;
      }
      return Promise.resolve({ data: revision, error: null }).then(resolve);
    },
  }));
  const changes = Array.from({ length: 501 }, (_, i) => ({ ...change, recordId: String(i) }));
  const owner = { owner: "alice", isCurrent: () => true };
  await expect(saveCloudChanges(changes, 1, owner)).rejects.toThrow("mock disconnect");
  expect(committed.size).toBe(500);
  await expect(saveCloudChanges(changes, 1, owner)).resolves.toBe(3);
  expect(committed.size).toBe(501);
  expect(mocks.rpc.mock.calls.map(([, args]) => args.expected_revision)).toEqual([1, 2, 1, 2]);
});
