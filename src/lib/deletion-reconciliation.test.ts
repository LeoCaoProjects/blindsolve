import { describe, it, expect } from "vitest";
import {
  emptyData,
  mergeData,
  reconcileSync,
  reconcilePeer,
  syncSnapshotEnvelope,
  diffSyncChanges,
  saveLocal,
  loadLocal,
  splitSyncBatches,
  coalesceSyncChanges,
  type SolveRecord,
  type LocalEnvelope,
  type SyncChange,
} from "./repository";
const id = "8d00ae21-5444-41df-a008-d7bfcdf2f741";
const stamp = "2026-11-05T01:00:00.000Z";
const solve = (extra: Partial<SolveRecord> = {}): SolveRecord => ({
  id,
  scramble: "R U",
  memoMs: 1000,
  executionMs: 2000,
  totalMs: 3000,
  result: "success",
  edgeMemo: [],
  cornerMemo: [],
  cycleBreaks: { edges: [], corners: [] },
  createdAt: "2026-10-01T00:00:00.000Z",
  ...extra,
});
const envelope = (solves: SolveRecord[] = []): LocalEnvelope => ({
  data: { ...emptyData(), solves },
  revision: 1,
  dirty: false,
  pending: {},
});
const deletion: SyncChange = {
  kind: "solve",
  recordId: id,
  payload: null,
  deleted: true,
  updatedAt: stamp,
};
const remoteDeleted = () =>
  syncSnapshotEnvelope(
    [
      {
        kind: "solve",
        record_id: id,
        payload: null,
        deleted: true,
        updated_at: stamp,
      },
    ],
    2,
  );
describe("deletion reconciliation", () => {
  it("keeps deletion ahead of a newer stale live copy in either merge order", () => {
    const deleted = envelope([solve({ deleted: true, updatedAt: stamp })]);
    const stale = envelope([solve({ updatedAt: "2026-11-06T00:00:00.000Z" })]);
    expect(mergeData(deleted.data, stale.data).data.solves[0].deleted).toBe(
      true,
    );
    expect(mergeData(stale.data, deleted.data).data.solves[0].deleted).toBe(
      true,
    );
  });
  it("keeps offline deletion until acknowledged, then persists it across reload", () => {
    const local = {
      ...envelope(),
      dirty: true,
      pending: { ["solve:" + id]: deletion },
    };
    const merged = reconcileSync(local, envelope([solve()]));
    expect(merged.data.solves).toEqual([]);
    expect(merged.pending?.["solve:" + id]).toEqual(deletion);
    const done = reconcileSync(merged, remoteDeleted());
    expect(done.dirty).toBe(false);
    expect(done.pending).toEqual({});
    saveLocal("deletion-test-account", done);
    expect(
      reconcileSync(loadLocal("deletion-test-account"), remoteDeleted()).data
        .solves,
    ).toEqual([]);
  });
  it("remote tombstones remove stale cache records and queued upserts", () => {
    const local = envelope([solve()]);
    local.pending = {
      ["solve:" + id]: { ...deletion, deleted: false, payload: solve() },
    };
    const result = reconcileSync(local, remoteDeleted());
    expect(result.data.solves).toEqual([]);
    expect(result.pending).toEqual({});
    expect(result.tombstones?.["solve:" + id]).toBe(stamp);
  });
  it("uses explicit soft-deletion evidence without interpreting absence as deletion", () => {
    const result = reconcileSync(
      envelope([solve({ deleted: true, updatedAt: stamp })]),
      envelope([solve()]),
    );
    expect(result.data.solves).toEqual([]);
    expect(result.pending?.["solve:" + id]).toMatchObject({
      deleted: true,
      payload: null,
    });
    expect(
      reconcileSync(envelope([solve()]), envelope()).data.solves,
    ).toHaveLength(1);
  });
  it("emits a record tombstone for soft solve deletion", () => {
    expect(
      diffSyncChanges(
        envelope([solve()]).data,
        envelope([solve({ deleted: true, updatedAt: stamp })]).data,
      ),
    ).toEqual([
      expect.objectContaining({
        kind: "solve",
        recordId: id,
        deleted: true,
        payload: null,
      }),
    ]);
  });
  it("keeps attempt deletions durable and repeated hydration duplicate-free", () => {
    const local = envelope();
    local.data.attempts = [
      {
        id,
        kind: "memo",
        correct: true,
        createdAt: stamp,
        trainingMode: "exec",
        durationMs: 5000,
      },
    ];
    const remote = syncSnapshotEnvelope(
      [
        {
          kind: "attempt",
          record_id: id,
          payload: null,
          deleted: true,
          updated_at: stamp,
        },
      ],
      3,
    );
    expect(
      reconcileSync(reconcileSync(local, remote), remote).data.attempts,
    ).toEqual([]);
    expect(
      reconcileSync(envelope([solve()]), envelope([solve()])).data.solves,
    ).toHaveLength(1);
  });
  it("isolates account deletion metadata", () => {
    saveLocal("deletion-test-alice", {
      ...envelope(),
      tombstones: { ["solve:" + id]: stamp },
    });
    saveLocal("deletion-test-bob", envelope([solve()]));
    expect(loadLocal("deletion-test-bob").data.solves).toHaveLength(1);
    expect(loadLocal("deletion-test-bob").tombstones).toBeUndefined();
    expect(loadLocal("deletion-test-alice").tombstones).toEqual({
      ["solve:" + id]: stamp,
    });
  });
});
describe("bounded sync writes", () => {
  it("keeps 10001 operations in ordered batches below server limits", () => {
    const changes = Array.from({ length: 10001 }, (_, index) => ({
      ...deletion,
      recordId: String(index),
    }));
    const batches = splitSyncBatches(changes);
    expect(batches).toHaveLength(21);
    expect(batches.every((batch) => batch.length <= 500)).toBe(true);
    expect(batches.flat()).toEqual(changes);
  });
  it("also bounds encoded payload bytes", () => {
    const changes = Array.from({ length: 30 }, (_, index) => ({
      ...deletion,
      recordId: String(index),
      deleted: false,
      payload: { evidence: "\u2211".repeat(100000) },
    }));
    const batches = splitSyncBatches(changes);
    expect(batches.length).toBeGreaterThan(1);
    expect(
      batches.every(
        (batch) =>
          new TextEncoder().encode(JSON.stringify(batch)).length < 4500000,
      ),
    ).toBe(true);
    expect(batches.flat()).toEqual(changes);
  });
  it("never overwrites a pending history deletion with a stale upsert", () => {
    expect(
      coalesceSyncChanges({ ["solve:" + id]: deletion }, [
        { ...deletion, deleted: false, payload: solve() },
      ])["solve:" + id],
    ).toEqual(deletion);
  });
});

describe("cross-tab delivery is not cloud acknowledgement", () => {
  it("keeps a peer upsert queued even though the peer already displays its data", () => {
    const pending = {
      ["solve:" + id]: { ...deletion, deleted: false, payload: solve() },
    };
    const local = { ...envelope([solve()]), pending, dirty: true };
    expect(reconcilePeer(local, local).pending).toEqual(pending);
  });
  it("keeps peer deletions queued until the cloud has acknowledged them", () => {
    const local = {
      ...envelope(),
      tombstones: { ["solve:" + id]: stamp },
      pending: { ["solve:" + id]: deletion },
      dirty: true,
    };
    const first = reconcilePeer(local, local);
    expect(first.pending?.["solve:" + id]).toEqual(deletion);
    const synced = reconcileSync(first, remoteDeleted());
    expect(reconcilePeer(first, synced).pending).toEqual({});
  });
  it("converges repeated peer hydration without losing newer pending attempt edits", () => {
    const old = {
      id,
      kind: "memo" as const,
      correct: false,
      createdAt: stamp,
      trainingMode: "exec" as const,
      durationMs: 1000,
    };
    const edited = { ...old, correct: true };
    const local = {
      ...envelope(),
      data: { ...emptyData(), attempts: [edited] },
      pending: {
        ["attempt:" + id]: {
          ...deletion,
          kind: "attempt" as const,
          deleted: false,
          payload: edited,
          updatedAt: "2026-11-05T02:00:00Z",
        },
      },
    };
    const peer = {
      ...envelope(),
      data: { ...emptyData(), attempts: [old] },
      pending: {
        ["attempt:" + id]: {
          ...deletion,
          kind: "attempt" as const,
          deleted: false,
          payload: old,
        },
      },
    };
    const merged = reconcilePeer(local, peer);
    expect(merged.data.attempts).toEqual([edited]);
    expect(merged.pending?.["attempt:" + id].updatedAt).toBe(
      "2026-11-05T02:00:00Z",
    );
    const repeated = reconcilePeer(merged, merged);
    expect(repeated.pending).toEqual(merged.pending);
    expect(repeated.data.attempts).toEqual([edited]);
  });
});
