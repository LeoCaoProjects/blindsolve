import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  rpc: vi.fn(),
  header: vi.fn(),
}));
vi.mock("./supabase", () => ({
  supabase: { auth: { getSession: mocks.session }, rpc: mocks.rpc },
}));
import { saveCloudChanges, type SyncChange } from "./repository";
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
