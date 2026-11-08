import { beforeEach, describe, it, expect } from "vitest";
import {
  emptyData,
  saveLocal,
  loadLocal,
  parseBackup,
  seedSyncChanges,
  syncSnapshotEnvelope,
  diffSyncChanges,
  mergeData,
  reconcileSync,
  coalesceSyncChanges,
  trackDeletions,
  type AppData,
  type LocalEnvelope,
} from "../../lib/repository";
import {
  pairsFromStore,
  writePairEntries,
  replacePairEntries,
  deleteFirstLetterPairs,
} from "./pairPersistence";
import { resolveWords, toTimerDb, timerWords } from "./pairs";
import type { PairEntry } from "../types/app";
const stamp = (n: number) =>
  `2026-11-07T10:00:${String(n).padStart(2, "0")}.000Z`;
const edit = (data: AppData, entry: PairEntry | null, n = 1) =>
  writePairEntries(data, { "A|B": entry }, stamp(n));
const vocabulary = (data: AppData) => pairsFromStore(data)["A|B"];
const effective = (data: AppData) => {
  const e = vocabulary(data);
  return ["shared", "edges", "corners"].map(
    (scope) =>
      resolveWords(e, scope as "shared" | "edges" | "corners").words[0],
  );
};
function reload(data: AppData, owner: string | null = "pair-test") {
  saveLocal(owner, { data, revision: 2, dirty: false, pending: {} });
  return loadLocal(owner).data;
}
function sync(data: AppData) {
  const rows = seedSyncChanges(data).map((c) => ({
    kind: c.kind,
    record_id: c.recordId,
    payload: JSON.parse(JSON.stringify(c.payload)),
    deleted: c.deleted,
    updated_at: c.updatedAt,
  }));
  return syncSnapshotEnvelope(rows, 3).data;
}
beforeEach(() => localStorage.clear());
describe("logical pair vocabulary survives the full persistence paths", () => {
  const scenarios: [string, PairEntry, string[]][] = [
    ["Shared only", { shared: ["Apple"] }, ["Apple", "Apple", "Apple"]],
    [
      "Shared + Edge",
      { shared: ["Apple"], edges: ["Arrow"] },
      ["Apple", "Arrow", "Apple"],
    ],
    [
      "Shared + Corner",
      { shared: ["Apple"], corners: ["Castle"] },
      ["Apple", "Apple", "Castle"],
    ],
    [
      "both overrides",
      { shared: ["Apple"], edges: ["Arrow"], corners: ["Castle"] },
      ["Apple", "Arrow", "Castle"],
    ],
  ];
  for (const [name, entry, values] of scenarios)
    it(name, () => {
      const data = edit(emptyData(), entry);
      for (const restored of [
        reload(data),
        reload(data, null),
        sync(data),
        parseBackup(JSON.stringify({ version: 3, data })),
      ]) {
        expect(vocabulary(restored)).toEqual(entry);
        expect(effective(restored)).toEqual(values);
        expect(Object.keys(restored.pairs)).toHaveLength(2);
        expect(diffSyncChanges(data, restored)).toEqual([]);
      }
    });
  it.each(["edges", "corners"] as const)(
    "removes %s override and does not resurrect it from stale sync",
    (scope) => {
      const old = edit(emptyData(), {
        shared: ["Apple"],
        edges: ["Arrow"],
        corners: ["Castle"],
      });
      const entry = { ...vocabulary(old) };
      delete entry[scope];
      const changed = edit(old, entry, 2);
      for (const restored of [
        reload(changed),
        sync(changed),
        mergeData(changed, old).data,
        mergeData(old, changed).data,
      ]) {
        expect(vocabulary(restored)[scope]).toBeUndefined();
        expect(resolveWords(vocabulary(restored), scope).words).toEqual([
          "Apple",
        ]);
      }
    },
  );
  it("edits Shared without destroying either override", () => {
    const before = edit(emptyData(), {
      shared: ["Apple"],
      edges: ["Arrow"],
      corners: ["Castle"],
    });
    const next = edit(before, { ...vocabulary(before), shared: ["Anchor"] }, 2);
    for (const restored of [
      reload(next),
      sync(next),
      mergeData(next, before).data,
    ])
      expect(vocabulary(restored)).toEqual({
        shared: ["Anchor"],
        edges: ["Arrow"],
        corners: ["Castle"],
      });
  });
  it.each([
    ["edges", "Axe"],
    ["corners", "Church"],
  ] as const)("updates %s without rewriting Shared", (scope, word) => {
    const before = edit(emptyData(), {
      shared: ["Apple"],
      edges: ["Arrow"],
      corners: ["Castle"],
    });
    const next = edit(before, { ...vocabulary(before), [scope]: [word] }, 2);
    expect(vocabulary(reload(next))).toEqual({
      ...vocabulary(before),
      [scope]: [word],
    });
    expect(
      diffSyncChanges(before, next).filter((c) => c.kind === "pair"),
    ).toHaveLength(1);
    expect(Object.keys(next.pairs)).toEqual(Object.keys(before.pairs));
    expect(Object.values(next.pairs).map((p) => p.id)).toEqual(
      Object.values(before.pairs).map((p) => p.id),
    );
  });
  it("retains an explicit override equal to Shared", () => {
    const entry = { shared: ["Apple"], edges: ["Apple"] };
    expect(vocabulary(reload(edit(emptyData(), entry)))).toEqual(entry);
  });
  it("supports clearing Shared while retaining overrides, then removing the last override", () => {
    const before = edit(emptyData(), { shared: ["Apple"], edges: ["Arrow"] });
    const cleared = edit(before, { shared: [], edges: ["Arrow"] }, 2);
    expect(vocabulary(reload(cleared))).toEqual({
      shared: [],
      edges: ["Arrow"],
    });
    const after = edit(cleared, null, 3);
    expect(after.pairs).toEqual({});
    const changes = diffSyncChanges(cleared, after, stamp(3));
    const local: LocalEnvelope = {
      data: after,
      dirty: true,
      revision: 2,
      pending: coalesceSyncChanges({}, changes),
      tombstones: trackDeletions({}, changes),
    };
    const remote: LocalEnvelope = {
      data: cleared,
      dirty: false,
      revision: 2,
      pending: {},
    };
    expect(reconcileSync(local, remote).data.pairs).toEqual({});
  });
  it("clears every pair including previous-scheme words and only enqueues pair deletions", () => {
    const before = edit(emptyData(), {
      shared: ["Apple"],
      edges: ["Arrow"],
      corners: ["Castle"],
    });
    Object.values(before.pairs).forEach((pair) => {
      pair.firstToken = "previous-scheme-token";
    });
    const after = replacePairEntries(before, {});
    expect(after.pairs).toEqual({});
    expect(after.solves).toBe(before.solves);
    expect(after.attempts).toBe(before.attempts);
    expect(after.scheme).toBe(before.scheme);
    const changes = diffSyncChanges(before, after);
    expect(changes).toHaveLength(Object.keys(before.pairs).length);
    expect(
      changes.every((change) => change.kind === "pair" && change.deleted),
    ).toBe(true);
  });
  it("deletes only actual records with the exact first token and survives stale sync/reload", () => {
    const before = writePairEntries(
      emptyData(),
      {
        "A|B": { shared: ["Apple"], edges: ["Arrow"], corners: ["Castle"] },
        "A|C": { shared: ["Ace"] },
        "B|C": { shared: ["Boat"], corners: ["Box"] },
        "C|D": { shared: ["Card"] },
      },
      stamp(1),
    );
    Object.values(before.pairs)
      .filter((p) => p.firstToken === "C")
      .forEach((p) => {
        p.firstToken = "AA";
      });
    const after = deleteFirstLetterPairs(before, "A");
    expect(Object.values(after.pairs).map((p) => p.firstToken)).not.toContain(
      "A",
    );
    expect(Object.values(after.pairs).some((p) => p.firstToken === "AA")).toBe(
      true,
    );
    expect(pairsFromStore(after)["B|C"]).toEqual(pairsFromStore(before)["B|C"]);
    expect({ ...after, pairs: undefined }).toEqual({
      ...before,
      pairs: undefined,
    });
    expect(after.solves).toBe(before.solves);
    expect(after.attempts).toBe(before.attempts);
    const changes = diffSyncChanges(before, after, stamp(9));
    const deleted = Object.entries(before.pairs)
      .filter(([, p]) => p.firstToken === "A")
      .map(([key]) => key)
      .sort();
    expect(changes.map((c) => c.recordId).sort()).toEqual(deleted);
    expect(changes.every((c) => c.kind === "pair" && c.deleted)).toBe(true);
    const local: LocalEnvelope = {
      data: reload(after),
      dirty: true,
      revision: 2,
      pending: coalesceSyncChanges(
        seedSyncChanges(before).reduce(
          (pending, change) => coalesceSyncChanges(pending, [change]),
          {},
        ),
        changes,
      ),
      tombstones: trackDeletions({}, changes),
    };
    const remote: LocalEnvelope = {
      data: before,
      dirty: false,
      revision: 2,
      pending: {},
    };
    expect(reconcileSync(local, remote).data.pairs).toEqual(after.pairs);
    expect(deleteFirstLetterPairs(after, "A")).toBe(after);
    for (const pair of Object.values(after.pairs)) {
      expect(pair).not.toHaveProperty("encounters");
      expect(pair).not.toHaveProperty("forgotten");
    }
  });
  it("does not enqueue hydration writeback or no-op saves", () => {
    const data = edit(emptyData(), { shared: ["Apple"], edges: ["Arrow"] });
    const restored = sync(reload(data));
    const copy = JSON.stringify(restored);
    pairsFromStore(restored);
    pairsFromStore(restored);
    expect(JSON.stringify(restored)).toBe(copy);
    expect(edit(restored, vocabulary(restored), 5)).toBe(restored);
    const envelope = { data: restored, dirty: false, revision: 2, pending: {} };
    const merged = reconcileSync(envelope, envelope);
    expect(merged.pending).toEqual({});
    expect(merged.dirty).toBe(false);
  });
  it("merges concurrent Edge and Corner edits without conflating either with Shared", () => {
    const base = edit(emptyData(), { shared: ["Apple"] });
    const edge = edit(base, { shared: ["Apple"], edges: ["Arrow"] }, 2);
    const corner = edit(base, { shared: ["Apple"], corners: ["Castle"] }, 3);
    for (const restored of [
      mergeData(edge, corner).data,
      mergeData(corner, edge).data,
    ])
      expect(vocabulary(restored)).toEqual({
        shared: ["Apple"],
        edges: ["Arrow"],
        corners: ["Castle"],
      });
  });
  it("keeps a newer Shared update when merging a later override edit with stale Shared metadata", () => {
    const base = edit(emptyData(), { shared: ["Apple"], edges: ["Arrow"] });
    const shared = edit(base, { shared: ["Anchor"], edges: ["Arrow"] }, 3);
    const edge = edit(base, { shared: ["Apple"], edges: ["Axe"] }, 4);
    const merged = mergeData(shared, edge).data;
    expect(vocabulary(merged)).toEqual({ shared: ["Anchor"], edges: ["Axe"] });
    expect(vocabulary(sync(merged))).toEqual(vocabulary(merged));
    const envelope = {
      data: sync(merged),
      dirty: false,
      revision: 3,
      pending: {},
    };
    expect(reconcileSync(envelope, envelope).pending).toEqual({});
  });
  it("keeps an earlier independent override when a later Shared edit syncs", () => {
    const base = edit(emptyData(), { shared: ["Apple"] });
    const edge = edit(base, { shared: ["Apple"], edges: ["Arrow"] }, 2);
    const shared = edit(base, { shared: ["Anchor"] }, 3);
    for (const data of [
      mergeData(edge, shared).data,
      mergeData(shared, edge).data,
    ])
      expect(vocabulary(data)).toEqual({
        shared: ["Anchor"],
        edges: ["Arrow"],
      });
  });
  it("uses the same persistence mapping for bulk replacement and leaves unchanged records untouched", () => {
    const data = edit(emptyData(), { shared: ["Apple"] });
    const added = writePairEntries(
      data,
      { "C|D": { shared: ["Castle"] } },
      stamp(2),
    );
    const before = Object.values(added.pairs).filter(
      (p) => p.firstToken === "C",
    );
    const replaced = replacePairEntries(
      added,
      {
        "A|B": { shared: ["Apple"], edges: ["Arrow"] },
        "C|D": { shared: ["Castle"] },
      },
      stamp(3),
    );
    expect(vocabulary(reload(replaced))).toEqual({
      shared: ["Apple"],
      edges: ["Arrow"],
    });
    expect(
      Object.values(replaced.pairs).filter((p) => p.firstToken === "C"),
    ).toEqual(before);
    expect(
      replacePairEntries(replaced, pairsFromStore(replaced), stamp(4)),
    ).toBe(replaced);
  });
  it("leaves ambiguous legacy records unmodified and does not guess missing historical Shared data", () => {
    const explicit = edit(emptyData(), { shared: ["Apple"], edges: ["Arrow"] });
    const legacy = structuredClone(explicit);
    Object.values(legacy.pairs).forEach((p) => delete p.vocabulary);
    const raw = JSON.stringify(legacy);
    pairsFromStore(legacy);
    expect(JSON.stringify(legacy)).toBe(raw);
    expect(diffSyncChanges(legacy, reload(legacy))).toEqual([]);
    expect(Object.values(reload(legacy).pairs).some((p) => p.vocabulary)).toBe(
      false,
    );
  });
  it("feeds correct effective words to Flashcards/Training and Timer reconstruction", () => {
    const data = reload(
      edit(emptyData(), {
        shared: ["Apple"],
        edges: ["Arrow"],
        corners: ["Castle"],
      }),
    );
    const db = pairsFromStore(data);
    expect(resolveWords(db["A|B"], "edges").words).toEqual(["Arrow"]);
    expect(resolveWords(db["A|B"], "corners").words).toEqual(["Castle"]);
    const timer = toTimerDb(db);
    expect(timerWords(timer, "AB", "edges")).toEqual(["Arrow"]);
    expect(timerWords(timer, "AB", "corners")).toEqual(["Castle"]);
    expect(timer.AB).toEqual(["Apple"]);
  });
});
