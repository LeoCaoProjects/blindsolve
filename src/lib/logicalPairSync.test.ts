import { beforeEach, describe, expect, it, vi } from "vitest";
import { mnemonicRecordKey } from "../domain/letterPairs/identity";
const wire = vi.hoisted(() => ({
  revision: 0,
  rows: new Map<string, unknown>(),
  calls: [] as Array<{ name: string; args: any }>,
  headers: [] as string[],
}));
vi.mock("./supabase", () => ({
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
    rpc: (name: string, args: any) => {
      wire.calls.push({ name, args });
      const request: any = {
        setHeader: (_key: string, value: string) => {
          wire.headers.push(value);
          return request;
        },
      };
      if (name === "apply_bld_sync_changes") {
        expect(args.expected_revision).toBe(wire.revision);
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
import {
  emptyData,
  saveCloudChanges,
  loadCloud,
  seedSyncChanges,
  diffSyncChanges,
  reconcileSync,
  saveLocal,
  loadLocal,
} from "./repository";
import {
  pairsFromStore,
  writeDefaultWords,
  deleteFirstLetterPairs,
} from "../magic/utils/pairPersistence";
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
