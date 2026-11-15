import { beforeEach, describe, expect, it, vi } from "vitest";
import { mnemonicRecordKey } from "../domain/letterPairs/identity";
type WireChange = {
  kind: string;
  record_id: string;
  payload: unknown;
  deleted: boolean;
  updated_at: string;
};
type WireArgs = { expected_revision: number; changes: WireChange[] };
type WireResponse = {
  data?: unknown;
  error?: { code: string; message: string } | null;
  setHeader: (key: string, value: string) => WireResponse;
};
const wire = vi.hoisted(() => ({
  revision: 0,
  rows: new Map<string, unknown>(),
  calls: [] as Array<{ name: string; args: WireArgs }>,
  headers: [] as string[],
}));
vi.mock("../lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: async () => ({
        data: {
          session: {
            user: { id: "local-test-owner" },
            access_token: "isolated-test-token",
          },
        },
      }),
    },
    rpc: (name: string, args: WireArgs) => {
      wire.calls.push({ name, args });
      const request: WireResponse = {
        setHeader: (_key: string, value: string) => {
          wire.headers.push(value);
          return request;
        },
      };
      if (name === "apply_bld_sync_changes") {
        if (args.expected_revision !== wire.revision) {
          request.data = null;
          request.error = { code: "40001", message: "Controlled stale revision" };
          return request;
        }
        for (const change of args.changes) {
          expect(change.record_id.length).toBeLessThanOrEqual(200);
          wire.rows.set(`${change.kind}:${change.record_id}`, {
            kind: change.kind,
            record_id: change.record_id,
            payload: change.payload,
            deleted: change.deleted,
            updated_at: change.updated_at,
          });
        }
        request.data = ++wire.revision;
        request.error = null;
      } else if (name === "get_bld_sync_snapshot") {
        request.data = {
          revision: wire.revision,
          records: [...wire.rows.values()],
        };
        request.error = null;
      } else throw new Error(`Unexpected test RPC ${name}`);
      return request;
    },
  },
}));
import { emptyData } from "./model";
import {
  saveCloudChanges,
  loadCloud,
  seedSyncChanges,
  diffSyncChanges,
  reconcileSync,
  saveLocal,
  loadLocal,
  coalesceSyncChanges,
  SyncConflictError,
} from "./repository";
import {
  pairsFromStore,
  writeDefaultWords,
  deleteFirstLetterPairs,
  writePairEntries,
} from "../workspace/utils/pairPersistence";
const context = { owner: "local-test-owner", isCurrent: () => true };
const stamp = (n: number) =>
  `2026-11-09T02:00:${String(n).padStart(2, "0")}.000Z`;
beforeEach(() => {
  wire.revision = 0;
  wire.rows.clear();
  wire.calls = [];
  wire.headers = [];
  localStorage.clear();
});
describe("isolated signed-in logical mnemonic transport", () => {
  it("keeps the accepted cloud value when competing writes share a timestamp", async () => {
    const original = writeDefaultWords(emptyData(), { "S|HB": "Original" }, stamp(1));
    await saveCloudChanges(seedSyncChanges(original), 0, context);
    const device = await loadCloud(context);
    const first = writeDefaultWords(device.data, { "S|HB": "Accepted" }, stamp(2));
    const second = writeDefaultWords(device.data, { "S|HB": "Stale peer" }, stamp(2));
    const pending = diffSyncChanges(device.data, second, stamp(2));
    await saveCloudChanges(diffSyncChanges(device.data, first, stamp(2)), device.revision, context);
    const result = reconcileSync({ ...device, data: second, dirty: true, pending: coalesceSyncChanges({}, pending) }, await loadCloud(context));
    expect(pairsFromStore(result.data)["S|HB"].shared).toEqual(["Accepted"]);
    expect(result.pending).toEqual({});
  });
  it("converges two stale device snapshots without merging token boundaries or rewriting history", async () => {
    const original = writeDefaultWords(emptyData(), { "S|HB": "Original", "SH|B": "Distinct" }, stamp(1));
    const history = {
      id: crypto.randomUUID(), scramble: "R U", memoMs: 1000, executionMs: 2000,
      totalMs: 3000, result: "success" as const, createdAt: stamp(1),
      cornerMemo: [], edgeMemo: ["S", "HB"], cycleBreaks: { edges: [], corners: [] },
      memoSnapshot: { corners: [], edges: [{
        firstStickerId: "U:UB", secondStickerId: "B:BU",
        firstToken: "S", secondToken: "HB", mnemonic: "Original historical word",
      }] },
    };
    const attempt = {
      id: crypto.randomUUID(), kind: "memo" as const, trainingMode: "recognition" as const,
      createdAt: stamp(1), durationMs: 900, targets: 3, correct: true, accuracy: 1,
    };
    original.solves = [history];
    original.attempts = [attempt];
    await saveCloudChanges(seedSyncChanges(original), 0, context);
    const a = await loadCloud(context);
    const b = await loadCloud(context);
    const editedA = writePairEntries(a.data, { "S|HB": { shared: ["Device A"], edges: ["A edge"] } }, stamp(2));
    editedA.scheme = structuredClone(editedA.scheme);
    for (const sticker of Object.values(editedA.scheme.stickers))
      if (sticker.label === "T") sticker.label = "SH";
    editedA.schemeUpdatedAt = stamp(2);
    const editedB = writePairEntries(b.data, { "S|HB": { shared: ["Device B"], corners: ["B corner"] } }, stamp(3));
    const bChanges = diffSyncChanges(b.data, editedB, stamp(3));
    await saveCloudChanges(diffSyncChanges(a.data, editedA, stamp(2)), a.revision, context);
    await expect(saveCloudChanges(bChanges, b.revision, context)).rejects.toBeInstanceOf(SyncConflictError);
    const mergedB = reconcileSync({
      ...b, data: editedB, dirty: true, pending: coalesceSyncChanges({}, bChanges),
    }, await loadCloud(context));
    await saveCloudChanges(Object.values(mergedB.pending!), mergedB.revision, context);
    const final = await loadCloud(context);
    const settledA = reconcileSync({ ...a, data: editedA }, final);
    expect(settledA.pending).toEqual({});
    expect(pairsFromStore(settledA.data)["S|HB"]).toMatchObject({
      shared: ["Device B"], edges: ["A edge"], corners: ["B corner"],
    });
    expect(pairsFromStore(settledA.data)["SH|B"].shared).toEqual(["Distinct"]);
    expect(settledA.data.schemeUpdatedAt).toBe(stamp(2));
    expect(settledA.data.solves).toEqual([history]);
    expect(settledA.data.attempts).toEqual([attempt]);
  });
  it("round-trips settings renames and independent logical words without a physical-ID mutation", async () => {
    const initial = writeDefaultWords(emptyData(), { "T|B": "Tub" }, stamp(1));
    let revision = await saveCloudChanges(seedSyncChanges(initial), 0, context);
    const renamed = structuredClone(initial);
    for (const s of Object.values(renamed.scheme.stickers))
      if (s.label === "T") s.label = "SH";
    renamed.schemeUpdatedAt = stamp(2);
    const settings = diffSyncChanges(initial, renamed);
    expect(settings.map((c) => c.kind)).toEqual(["settings"]);
    revision = await saveCloudChanges(settings, revision, context);
    const edited = writeDefaultWords(renamed, { "SH|B": "Ship" }, stamp(3));
    const mutations = diffSyncChanges(renamed, edited);
    expect(mutations).toHaveLength(1);
    expect(mutations[0].recordId).toBe(mnemonicRecordKey("SH", "B", "shared"));
    expect(JSON.stringify(mutations[0].payload)).not.toContain("StickerId");
    revision = await saveCloudChanges(mutations, revision, context);
    const cloud = await loadCloud();
    expect(cloud.revision).toBe(revision);
    expect(pairsFromStore(cloud.data)["T|B"].shared).toEqual(["Tub"]);
    expect(pairsFromStore(cloud.data)["SH|B"].shared).toEqual(["Ship"]);
    saveLocal(context.owner, cloud);
    const reloaded = loadLocal(context.owner);
    expect(reconcileSync(reloaded, cloud).pending).toEqual({});
    expect(wire.headers).toContain("Bearer isolated-test-token");
  });
  it("hydrates logical tombstones and does not revive deleted words from an old-lettering device", async () => {
    const initial = writeDefaultWords(
      emptyData(),
      { "T|B": "Tub", "SH|B": "Ship" },
      stamp(1),
    );
    let revision = await saveCloudChanges(seedSyncChanges(initial), 0, context);
    const deleted = deleteFirstLetterPairs(initial, "T");
    revision = await saveCloudChanges(
      diffSyncChanges(initial, deleted),
      revision,
      context,
    );
    const cloud = await loadCloud();
    expect(pairsFromStore(cloud.data)["T|B"]).toBeUndefined();
    expect(pairsFromStore(cloud.data)["SH|B"].shared).toEqual(["Ship"]);
    const stale = { data: initial, revision: 1, dirty: false, pending: {} };
    const reconciled = reconcileSync(stale, cloud);
    expect(pairsFromStore(reconciled.data)["T|B"]).toBeUndefined();
    expect(
      Object.values(reconciled.pending ?? {}).some(
        (c) =>
          !c.deleted && c.recordId === mnemonicRecordKey("T", "B", "shared"),
      ),
    ).toBe(false);
    expect(reconciled.revision).toBe(revision);
  });
});
