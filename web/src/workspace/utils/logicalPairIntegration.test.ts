import { beforeEach, describe, expect, it } from "vitest";
import { emptyData, parseData, type AppData } from "../../data/model";
import {
  diffSyncChanges,
  saveLocal,
  loadLocal,
  seedSyncChanges,
  syncSnapshotEnvelope,
  mergeData,
  reconcileSync,
  coalesceSyncChanges,
  trackDeletions,
  applyTombstones,
  deletionIndex,
} from "../../data/repository";
import { parseBackup } from "../../data/backup";
import {
  pairKey as physicalKey,
  type LetterPair,
} from "../../domain/letterPairs";
import {
  mnemonicRecordKey,
  memoPairReference,
} from "../../domain/letterPairs/identity";
import {
  pairsFromStore,
  writeDefaultWords,
  writePairEntries,
  deleteFirstLetterPairs,
} from "./pairPersistence";
import { activePairVocabulary } from "./activePairs";
import { setupFromStore } from "../contexts/AppDataContext";
import { timerWords, toTimerDb } from "./pairs";
const stamp = (n: number) =>
  `2026-11-09T01:00:${String(n).padStart(2, "0")}.000Z`;
function fixture() {
  const data = emptyData();
  data.onboarded = true;
  for (const [piece, override] of [
    ["edge", "Timber"],
    ["corner", "Tower"],
  ] as const) {
    const first = Object.values(data.scheme.stickers).find(
      (s) => s.pieceType === piece && s.label === "T",
    )!;
    const second = Object.values(data.scheme.stickers).find(
      (s) => s.pieceType === piece && s.label === "B",
    )!;
    data.pairs[physicalKey(first.id, second.id)] = {
      id: crypto.randomUUID(),
      firstStickerId: first.id,
      secondStickerId: second.id,
      firstToken: "T",
      secondToken: "B",
      primaryMnemonic: override,
      updatedAt: stamp(1),
      vocabulary: {
        shared: ["Tub"],
        override: [override],
        sharedUpdatedAt: stamp(1),
        overrideUpdatedAt: stamp(1),
      },
    };
  }
  return data;
}
function rename(
  data: AppData,
  from: string,
  to: string,
  n: number,
  piece?: "edge" | "corner",
) {
  return {
    ...data,
    scheme: {
      ...data.scheme,
      stickers: Object.fromEntries(
        Object.entries(data.scheme.stickers).map(([id, s]) => [
          id,
          {
            ...s,
            label:
              s.label === from && (!piece || s.pieceType === piece)
                ? to
                : s.label,
          },
        ]),
      ),
    },
    schemeUpdatedAt: stamp(n),
  };
}
function reload(data: AppData) {
  saveLocal(null, { data, revision: 1, dirty: false });
  return loadLocal().data;
}
function hydrate(data: AppData) {
  return syncSnapshotEnvelope(
    seedSyncChanges(data).map((c) => ({
      kind: c.kind,
      record_id: c.recordId,
      payload: c.payload,
      deleted: c.deleted,
      updated_at: c.updatedAt,
    })),
    2,
  ).data;
}
const view = (data: AppData) =>
  activePairVocabulary(setupFromStore(data).scheme);
beforeEach(() => localStorage.clear());

describe("logical mnemonic data integrity", () => {
  it("never weakens newer envelope deletion evidence with older imported logical metadata", () => {
    const key = mnemonicRecordKey("T", "B", "shared");
    const data = { ...fixture(), logicalPairDeletions: { [key]: stamp(2) } };
    expect(
      deletionIndex({
        data,
        dirty: false,
        revision: 0,
        tombstones: { [`pair:${key}`]: stamp(9) },
      })[`pair:${key}`],
    ).toBe(stamp(9));
    const restored = writeDefaultWords(data, { "T|B": "Recreated" }, stamp(10));
    expect(
      pairsFromStore(applyTombstones(restored, { [`pair:${key}`]: stamp(9) }))[
        "T|B"
      ].shared,
    ).toEqual(["Recreated"]);
  });
  it("removes inactive T from navigation without touching its words, creates only the edited SH word, and restores T", () => {
    const original = fixture(),
      raw = JSON.stringify(original.pairs);
    const changed = rename(original, "T", "SH", 2);
    expect(view(changed).axes).not.toContain("T");
    expect(view(changed).axes).toContain("SH");
    expect(view(changed).possible("SH", "B")).toBe(true);
    expect(diffSyncChanges(original, changed).map((c) => c.kind)).toEqual([
      "settings",
    ]);
    expect(pairsFromStore(changed)["SH|B"]).toBeUndefined();
    const edited = writeDefaultWords(changed, { "SH|B": "Ship" }, stamp(3));
    expect(JSON.stringify(edited.pairs)).toBe(raw);
    const changes = diffSyncChanges(changed, edited);
    expect(changes).toHaveLength(1);
    expect(changes[0].recordId).toBe(mnemonicRecordKey("SH", "B", "shared"));
    expect(JSON.stringify(changes[0].payload)).not.toContain("StickerId");
    for (const data of [
      reload(edited),
      hydrate(edited),
      parseBackup(JSON.stringify({ version: 3, data: edited })),
    ]) {
      expect(pairsFromStore(data)["T|B"]).toEqual({
        shared: ["Tub"],
        edges: ["Timber"],
        corners: ["Tower"],
      });
      expect(pairsFromStore(data)["SH|B"]).toEqual({ shared: ["Ship"] });
      const returned = rename(data, "SH", "T", 4);
      expect(view(returned).axes).toContain("T");
      expect(view(returned).axes).not.toContain("SH");
      expect(
        diffSyncChanges(data, returned).filter((c) => c.kind === "pair"),
      ).toHaveLength(0);
    }
  });
  it("keeps Edge-only T and Corner-only SH active without showing impossible cross-scope combinations", () => {
    const data = rename(fixture(), "T", "SH", 2, "corner");
    const active = view(data);
    expect(active.axes).toContain("T");
    expect(active.axes).toContain("SH");
    expect(active.possible("T", "B", "edges")).toBe(true);
    expect(active.possible("T", "B", "corners")).toBe(false);
    expect(active.possible("T", "SH")).toBe(false);
    expect(pairsFromStore(data)["T|B"].corners).toEqual(["Tower"]);
  });
  it("reuses historical SH words on a different physical sticker and preserves sequential T/SH/Z words", () => {
    const a = writeDefaultWords(
      rename(fixture(), "T", "SH", 2),
      { "SH|B": "Ship" },
      stamp(3),
    );
    const b = writeDefaultWords(
      rename(a, "SH", "Z", 4),
      { "Z|B": "Zebra" },
      stamp(5),
    );
    const c = rename(b, "X", "SH", 6);
    expect(pairsFromStore(reload(c))["SH|B"].shared).toEqual(["Ship"]);
    const d = rename(c, "Z", "T", 7);
    expect(pairsFromStore(d)["T|B"].shared).toEqual(["Tub"]);
    expect(pairsFromStore(d)["Z|B"].shared).toEqual(["Zebra"]);
    expect(
      diffSyncChanges(c, d).filter((change) => change.kind === "pair"),
    ).toHaveLength(0);
  });
  it("never swaps words when T and F stickers swap and words are edited afterward", () => {
    const original = writeDefaultWords(
      fixture(),
      { "F|B": "Football" },
      stamp(2),
    );
    const swapped = structuredClone(original);
    for (const s of Object.values(swapped.scheme.stickers)) {
      if (s.label === "T") s.label = "F";
      else if (s.label === "F") s.label = "T";
    }
    swapped.schemeUpdatedAt = stamp(3);
    expect(
      diffSyncChanges(original, swapped).filter((c) => c.kind === "pair"),
    ).toHaveLength(0);
    const edited = writeDefaultWords(swapped, { "F|B": "Fox" }, stamp(4));
    expect(pairsFromStore(edited)["T|B"].shared).toEqual(["Tub"]);
    expect(pairsFromStore(edited)["F|B"].shared).toEqual(["Fox"]);
    expect(edited.pairs).toEqual(original.pairs);
  });
  it("merges an old-lettering device's TB edit independently of a relabelled device's SHB edit", () => {
    const old = fixture();
    const a = writeDefaultWords(
      rename(old, "T", "SH", 2),
      { "SH|B": "Ship" },
      stamp(3),
    );
    const b = writeDefaultWords(old, { "T|B": "Tub updated" }, stamp(4));
    for (const data of [mergeData(a, b).data, mergeData(b, a).data]) {
      expect(pairsFromStore(data)["T|B"]).toEqual({
        shared: ["Tub updated"],
        edges: ["Timber"],
        corners: ["Tower"],
      });
      expect(pairsFromStore(data)["SH|B"].shared).toEqual(["Ship"]);
    }
  });
  it("keeps canonical scopes authoritative over disagreeing legacy rows without deleting their source", () => {
    const old = fixture();
    const canonical = writeDefaultWords(old, { "T|B": "New" }, stamp(2));
    const stale = structuredClone(old);
    for (const record of Object.values(stale.pairs)) {
      record.updatedAt = stamp(9);
      record.vocabulary!.shared = ["Old device"];
      record.vocabulary!.sharedUpdatedAt = stamp(9);
    }
    const merged = mergeData(canonical, stale).data;
    expect(pairsFromStore(merged)["T|B"].shared).toEqual(["New"]);
    expect(
      Object.values(merged.pairs).some(
        (record) => record.vocabulary?.shared[0] === "Old device",
      ),
    ).toBe(true);
  });
  it("deletes T logically, masks stale legacy copies through reload/sync/rename, and ignores unrelated physical tombstones", () => {
    const original = fixture(),
      deleted = deleteFirstLetterPairs(original, "T");
    expect(deleted.pairs).toBe(original.pairs);
    expect(pairsFromStore(deleted)["T|B"]).toBeUndefined();
    const changes = diffSyncChanges(original, deleted);
    expect(changes).toHaveLength(3);
    expect(
      changes.every(
        (c) => c.deleted && c.recordId.startsWith('["mnemonic-v1"'),
      ),
    ).toBe(true);
    const local = {
      data: deleted,
      revision: 2,
      dirty: true,
      pending: coalesceSyncChanges({}, changes),
      tombstones: trackDeletions({}, changes),
    };
    const remote = { data: original, revision: 1, dirty: false, pending: {} };
    for (const data of [
      reload(deleted),
      hydrate(deleted),
      reconcileSync(local, remote).data,
    ]) {
      const returned = rename(rename(data, "T", "SH", 3), "SH", "T", 4);
      expect(pairsFromStore(returned)["T|B"]).toBeUndefined();
    }
    const withShip = writeDefaultWords(original, { "SH|B": "Ship" }, stamp(3));
    const physicalDeletes = Object.fromEntries(
      Object.keys(original.pairs).map((key) => [`pair:${key}`, stamp(9)]),
    );
    expect(
      pairsFromStore(applyTombstones(withShip, physicalDeletes))["SH|B"].shared,
    ).toEqual(["Ship"]);
  });
  it("preserves legacy physical-key collisions as evidence rather than losing either logical pair", () => {
    const old = fixture(),
      remote = structuredClone(old);
    for (const record of Object.values(remote.pairs)) {
      record.firstToken = "SH";
      record.primaryMnemonic = "Ship";
      record.updatedAt = stamp(2);
      delete record.vocabulary;
    }
    const merged = reload(mergeData(old, remote).data);
    expect(pairsFromStore(merged)["T|B"].shared).toEqual(["Tub"]);
    expect(pairsFromStore(merged)["SH|B"].shared).toEqual(["Ship"]);
    expect(Object.values(merged.pairs)).toHaveLength(4);
  });
  it("preserves ambiguous legacy words without assigning their missing labels from today's scheme", () => {
    const data = fixture();
    const raw = structuredClone(data) as unknown as {
      pairs: Record<string, Partial<LetterPair>>;
    };
    for (const pair of Object.values(raw.pairs)) delete pair.firstToken;
    const parsed = parseData(raw);
    expect(Object.values(parsed.pairs)).toHaveLength(2);
    expect(
      Object.values(parsed.pairs).every(
        (pair) => pair.primaryMnemonic.length > 0,
      ),
    ).toBe(true);
    expect(pairsFromStore(parsed)["T|B"]).toBeUndefined();
  });
  it("keeps orientation/buffer-only changes independent and normalizes labels without rewriting solve snapshots", () => {
    const old = writeDefaultWords(fixture(), { "SH|B": "Ship" }, stamp(2));
    const changed = structuredClone(old);
    changed.defaultCubeView = { top: "white", front: "blue" };
    changed.scheme.edgeBuffer = "U:UB";
    changed.preferencesUpdatedAt = stamp(3);
    changed.schemeUpdatedAt = stamp(3);
    expect(diffSyncChanges(old, changed).map((c) => c.kind)).toEqual([
      "settings",
    ]);
    expect(pairsFromStore(changed)).toEqual(pairsFromStore(old));
    const normalized = writeDefaultWords(
      changed,
      { " sh | b ": "Changed" },
      stamp(4),
    );
    expect(pairsFromStore(normalized)["SH|B"].shared).toEqual(["Changed"]);
  });
  it("keeps S+HB and SH+B distinct across lookup, scoped records, backup and hydration", () => {
    const original = writePairEntries(
      emptyData(),
      {
        "S|HB": { shared: ["First"], edges: ["Edge first"] },
        "SH|B": { shared: ["Second"], corners: ["Corner second"] },
      },
      stamp(1),
    );
    for (const data of [
      reload(original),
      hydrate(original),
      parseBackup(JSON.stringify({ version: 3, data: original })),
    ]) {
      const db = toTimerDb(pairsFromStore(data));
      expect(timerWords(db, ["S", "HB"], "edges")).toEqual(["Edge first"]);
      expect(timerWords(db, ["SH", "B"], "corners")).toEqual(["Corner second"]);
      expect(timerWords(db, memoPairReference(["S", "HB"]), "corners")).toEqual(
        ["First"],
      );
      expect(timerWords(db, "SHB", "edges")).toEqual([]); // Ambiguous old display is never an identity.
    }
  });
});
