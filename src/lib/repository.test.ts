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
  pruneAcknowledgedSyncChanges,
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
              secondExecutionStickerId: "D:DB",
              secondExecutionToken: "7X",
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
    expect(parsed.solves[0].memoSnapshot?.edges[0].secondExecutionToken).toBe(
      "7X",
    );
  });
  it("does not create a sync diff after execution-target snapshot hydration", () => {
    const cloud = emptyData();
    cloud.solves = [
      {
        id: crypto.randomUUID(),
        scramble: "R U",
        memoMs: 1_000,
        executionMs: 2_000,
        totalMs: 3_000,
        result: "success",
        edgeMemo: ["ALPHA", "foo"],
        cornerMemo: [],
        cycleBreaks: { edges: [], corners: [] },
        createdAt: "2026-10-09T00:00:00.000Z",
        updatedAt: "2026-10-09T00:00:01.000Z",
        memoSnapshot: {
          corners: [],
          edges: [
            {
              firstStickerId: "U:UF",
              secondStickerId: "F:UF",
              firstToken: "ALPHA",
              secondToken: "foo",
              secondExecutionStickerId: "B:DB",
              secondExecutionToken: "BAR-2",
              mnemonic: "custom image",
            },
          ],
        },
      },
    ];
    const hydrated = parseData(structuredClone(cloud));

    expect(diffSyncChanges(cloud, hydrated)).toEqual([]);
    expect(diffSyncChanges(cloud, mergeData(cloud, hydrated).data)).toEqual([]);
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
  it("defaults show-live-timer on and round-trips the disabled preference", () => {
    expect(emptyData().showLiveTimer).toBe(true);
    const data = emptyData();
    data.showLiveTimer = false;
    data.preferencesUpdatedAt = "2026-09-25T03:00:00Z";
    expect(
      parseBackup(JSON.stringify({ version: 3, data })).showLiveTimer,
    ).toBe(false);
  });
  it("merges show-live-timer with the shared preference timestamp", () => {
    const local = emptyData();
    const cloud = emptyData();
    local.preferencesUpdatedAt = "2026-09-25T01:00:00Z";
    cloud.showLiveTimer = false;
    cloud.preferencesUpdatedAt = "2026-09-25T02:00:00Z";
    expect(mergeData(local, cloud).data.showLiveTimer).toBe(false);
  });
  it("defaults and round-trips M2 and memo-order preferences", () => {
    expect(emptyData()).toMatchObject({
      m2SecondTargetSwap: false,
      memoOrder: "corners-first",
    });
    const data = emptyData();
    data.m2SecondTargetSwap = true;
    data.memoOrder = "edges-first";
    expect(parseBackup(JSON.stringify({ version: 3, data }))).toMatchObject({
      m2SecondTargetSwap: true,
      memoOrder: "edges-first",
    });
  });
  it("merges M2 and memo order with the shared preference timestamp", () => {
    const local = emptyData();
    const cloud = emptyData();
    local.preferencesUpdatedAt = "2026-09-25T01:00:00Z";
    cloud.preferencesUpdatedAt = "2026-09-25T02:00:00Z";
    cloud.m2SecondTargetSwap = true;
    cloud.memoOrder = "edges-first";
    expect(mergeData(local, cloud).data).toMatchObject({
      m2SecondTargetSwap: true,
      memoOrder: "edges-first",
    });
  });
  it("accepts and preserves deprecated orientation fields without a sync diff", () => {
    const cloud = emptyData();
    cloud.scheme.orientation = { up: "U", front: "L" };
    cloud.schemeUpdatedAt = "2026-09-25T02:00:00Z";
    cloud.flippedEdges = "separate";
    cloud.twistedCorners = "separate";
    cloud.preferencesUpdatedAt = "2026-09-25T02:00:00Z";
    const hydrated = parseData(structuredClone(cloud));

    expect(hydrated).toMatchObject({
      scheme: { orientation: { up: "U", front: "L" } },
      flippedEdges: "separate",
      twistedCorners: "separate",
    });
    expect(diffSyncChanges(cloud, hydrated)).toEqual([]);
    expect(
      diffSyncChanges(cloud, mergeData(structuredClone(cloud), cloud).data),
    ).toEqual([]);
  });
  it("does not create a settings diff when identical data is merged", () => {
    const local = emptyData();
    const cloud = structuredClone(local);
    expect(diffSyncChanges(cloud, mergeData(local, cloud).data)).toEqual([]);
  });
  it("preserves timer sessions and active session through a cloud merge", () => {
    const local = emptyData();
    const cloud = emptyData();
    cloud.timerSessions = [
      { id: "cloud", name: "Cloud", createdAt: "2026-09-25T01:00:00Z" },
    ];
    cloud.activeTimerSessionId = "cloud";
    cloud.preferencesUpdatedAt = "2026-09-25T02:00:00Z";
    local.preferencesUpdatedAt = "2026-09-25T01:00:00Z";
    const merged = mergeData(local, cloud).data;
    expect(merged.timerSessions).toEqual(cloud.timerSessions);
    expect(merged.activeTimerSessionId).toBe("cloud");
  });
  it("keeps newer local timer-session settings", () => {
    const local = emptyData();
    const cloud = emptyData();
    local.timerSessions = [
      { id: "local", name: "Local", createdAt: "2026-09-25T03:00:00Z" },
    ];
    local.activeTimerSessionId = "local";
    local.preferencesUpdatedAt = "2026-09-25T03:00:00Z";
    cloud.timerSessions = [
      { id: "cloud", name: "Cloud", createdAt: "2026-09-25T02:00:00Z" },
    ];
    cloud.activeTimerSessionId = "cloud";
    cloud.preferencesUpdatedAt = "2026-09-25T02:00:00Z";
    const merged = mergeData(local, cloud).data;
    expect(merged.timerSessions).toEqual(local.timerSessions);
    expect(merged.activeTimerSessionId).toBe("local");
  });
  it("creates one settings change for one multiphase toggle", () => {
    const before = emptyData();
    const after = structuredClone(before);
    after.multiphaseTiming = false;
    after.preferencesUpdatedAt = "2026-09-25T03:00:00Z";
    expect(diffSyncChanges(before, after)).toEqual([
      expect.objectContaining({ kind: "settings", recordId: "settings" }),
    ]);
  });
  it("creates one settings change for one show-live-timer toggle", () => {
    const before = emptyData();
    const after = structuredClone(before);
    after.showLiveTimer = false;
    after.preferencesUpdatedAt = "2026-09-25T03:00:00Z";
    expect(diffSyncChanges(before, after)).toEqual([
      expect.objectContaining({ kind: "settings", recordId: "settings" }),
    ]);
  });
  it.each([
    ["m2SecondTargetSwap", true],
    ["memoOrder", "edges-first"],
  ] as const)("creates one settings change for %s", (key, value) => {
    const before = emptyData();
    const after = structuredClone(before);
    Object.assign(after, {
      [key]: value,
      preferencesUpdatedAt: "2026-09-25T03:00:00Z",
    });
    expect(diffSyncChanges(before, after)).toEqual([
      expect.objectContaining({ kind: "settings", recordId: "settings" }),
    ]);
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
  it("drops pending records already acknowledged by a cloud snapshot", () => {
    const before = emptyData();
    const cloud = emptyData();
    const key = pairKey("B:BR", "D:DB");
    cloud.pairs[key] = pair("tow");
    const pending = coalesceSyncChanges(
      {},
      diffSyncChanges(before, cloud, "2026-09-28T00:00:00Z"),
    );
    expect(pruneAcknowledgedSyncChanges(cloud, pending)).toEqual({});
  });
  it("preserves a pending deletion until the cloud snapshot no longer has it", () => {
    const cloud = emptyData();
    const local = emptyData();
    const key = pairKey("B:BR", "D:DB");
    cloud.pairs[key] = pair("tow");
    const pending = coalesceSyncChanges(
      {},
      diffSyncChanges(cloud, local, "2026-09-28T00:00:00Z"),
    );
    expect(Object.keys(pruneAcknowledgedSyncChanges(cloud, pending))).toEqual([
      `pair:${key}`,
    ]);
    expect(pruneAcknowledgedSyncChanges(local, pending)).toEqual({});
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
