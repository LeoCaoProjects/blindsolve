import { describe, it, expect, beforeEach } from "vitest";
import {
  emptyData,
  parseBackup,
  parseData,
  mergeData,
  loadLocal,
  saveLocal,
  validateScheme,
  diffSyncChanges,
  coalesceSyncChanges,
  seedSyncChanges,
  syncRetryDelay,
} from "./repository";
import { pairKey, type LetterPair } from "../domain/letterPairs";
const pair = (word: string, time = "2026-09-25T00:00:00Z"): LetterPair => ({
  id: "c4c10d7a-17c6-4020-ad6f-4cbd96c5e821",
  firstStickerId: "B:BR",
  secondStickerId: "D:DB",
  firstToken: "T",
  secondToken: "W",
  primaryMnemonic: word,
  alternates: [],
  encounters: 1,
  forgotten: 0,
  updatedAt: time,
});
describe("workspace integrity", () => {
  beforeEach(() => localStorage.clear());
  it("isolates device and account storage", () => {
    const d = emptyData();
    d.onboarded = true;
    saveLocal("alice", { data: d, dirty: true, revision: 4 });
    expect(loadLocal().data.onboarded).toBe(false);
    expect(loadLocal("bob").revision).toBe(0);
    expect(loadLocal("alice").revision).toBe(4);
  });
  it("retains both conflicting words and combines independent records", () => {
    const a = emptyData(),
      b = emptyData(),
      key = pairKey("B:BR", "D:DB");
    a.pairs[key] = pair("tow");
    b.pairs[key] = pair("tower", "2026-09-25T01:00:00Z");
    const merged = mergeData(a, b);
    expect(merged.conflicts).toBe(1);
    expect(merged.data.pairs[key].primaryMnemonic).toBe("tower");
    expect(merged.data.pairs[key].alternates).toEqual(["tow"]);
  });
  it("does not duplicate equivalent alternates", () => {
    const a = emptyData(),
      b = emptyData(),
      key = pairKey("B:BR", "D:DB");
    a.pairs[key] = pair(" Tow ");
    b.pairs[key] = pair("tow");
    expect(mergeData(a, b).data.pairs[key].alternates).toEqual([]);
  });
  it("rejects malformed backup and invalid timing", () => {
    expect(() => parseBackup('{"pairs":[]}')).toThrow();
    const d = emptyData();
    d.solves = [
      {
        id: crypto.randomUUID(),
        scramble: "R",
        memoMs: 10,
        executionMs: 20,
        totalMs: 99,
        result: "success",
        edgeMemo: [],
        cornerMemo: [],
        cycleBreaks: { edges: [], corners: [] },
        createdAt: new Date().toISOString(),
      },
    ];
    expect(() => parseData(d)).toThrow();
  });
  it("accepts multi-character tokens without changing physical identity", () => {
    const d = emptyData();
    d.scheme.stickers["U:UB"].label = "CH";
    d.pairs[pairKey("B:BR", "D:DB")] = pair("tow");
    expect(
      parseBackup(JSON.stringify({ version: 2, data: d })).scheme.stickers[
        "U:UB"
      ].label,
    ).toBe("CH");
  });
  it("validates duplicate tokens and impossible orientations", () => {
    const d = emptyData();
    d.scheme.stickers["U:UB"].label = "B";
    expect(validateScheme(d.scheme)).toContain("unique");
    d.scheme = emptyData().scheme;
    d.scheme.orientation.front = "D";
    expect(validateScheme(d.scheme)).toContain("adjacent");
  });
  it("keeps deletion tombstones when older backup is imported", () => {
    const a = emptyData(),
      b = emptyData(),
      s = {
        id: crypto.randomUUID(),
        scramble: "R",
        memoMs: 10,
        executionMs: 20,
        totalMs: 30,
        result: "success" as const,
        edgeMemo: [],
        cornerMemo: [],
        cycleBreaks: { edges: [], corners: [] },
        createdAt: "2026-09-24T00:00:00Z",
      };
    b.solves = [s];
    a.solves = [{ ...s, deleted: true, updatedAt: "2026-09-25T00:00:00Z" }];
    expect(mergeData(a, b).data.solves[0].deleted).toBe(true);
  });
  it("round-trips +2, multiphase preference and immutable memo words", () => {
    const data = emptyData();
    data.multiphaseTiming = false;
    data.preferencesUpdatedAt = "2026-09-25T03:00:00Z";
    data.solves = [
      {
        id: crypto.randomUUID(),
        scramble: "R U",
        memoMs: 0,
        executionMs: 12340,
        totalMs: 12340,
        result: "+2",
        edgeMemo: ["CH", "1"],
        cornerMemo: [],
        cycleBreaks: { edges: [], corners: [] },
        createdAt: "2026-09-25T03:00:00Z",
        reconstruction: "complete",
        multiphase: false,
        memoSnapshot: {
          corners: [],
          edges: [
            {
              firstStickerId: "U:UB",
              secondStickerId: "B:BU",
              firstToken: "CH",
              secondToken: "1",
              mnemonic: "church",
            },
          ],
        },
      },
    ];
    const parsed = parseBackup(JSON.stringify({ version: 3, data }));
    expect(parsed.multiphaseTiming).toBe(false);
    expect(parsed.solves[0].result).toBe("+2");
    expect(parsed.solves[0].memoSnapshot?.edges[0].mnemonic).toBe("church");
  });
  it("uses the newest persisted timer preference during conflict merge", () => {
    const local = emptyData();
    const cloud = emptyData();
    local.multiphaseTiming = true;
    local.preferencesUpdatedAt = "2026-09-25T01:00:00Z";
    cloud.multiphaseTiming = false;
    cloud.preferencesUpdatedAt = "2026-09-25T02:00:00Z";
    expect(mergeData(local, cloud).data.multiphaseTiming).toBe(false);
  });
  it("creates only the changed record for one letter-pair edit", () => {
    const before = emptyData();
    const after = emptyData();
    const key = pairKey("B:BR", "D:DB");
    after.pairs[key] = pair("tow");
    expect(diffSyncChanges(before, after, "2026-09-28T00:00:00Z")).toEqual([
      expect.objectContaining({ kind: "pair", recordId: key, deleted: false }),
    ]);
  });
  it("deduplicates repeated pending changes to the same record", () => {
    const before = emptyData();
    const first = emptyData();
    const second = emptyData();
    const key = pairKey("B:BR", "D:DB");
    first.pairs[key] = pair("tow");
    second.pairs[key] = pair("tower", "2026-09-28T00:01:00Z");
    const pending = coalesceSyncChanges(
      coalesceSyncChanges({}, diffSyncChanges(before, first)),
      diffSyncChanges(first, second),
    );
    expect(Object.keys(pending)).toEqual([`pair:${key}`]);
    expect(pending[`pair:${key}`].payload).toMatchObject({
      primaryMnemonic: "tower",
    });
  });
  it("seeds settings and each historical entity exactly once", () => {
    const data = emptyData();
    const key = pairKey("B:BR", "D:DB");
    data.pairs[key] = pair("tow");
    expect(seedSyncChanges(data).map((change) => change.kind)).toEqual([
      "settings",
      "pair",
    ]);
  });
  it("uses bounded exponential retry delays without a tight loop", () => {
    expect([0, 1, 2, 3, 4, 20].map(syncRetryDelay)).toEqual([
      2000, 4000, 8000, 16000, 32000, 60000,
    ]);
  });
});
