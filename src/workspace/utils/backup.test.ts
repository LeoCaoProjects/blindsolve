import { describe, expect, it } from "vitest";
import {
  applyTombstones,
  diffSyncChanges,
  emptyData,
  mergeData,
  parseBackup,
  trackDeletions,
  type AppData,
} from "../../lib/repository";
import { buildBackup, mergeBackup, type MergeStrategy } from "./backup";

const id = "4c8b15b6-937d-4820-b214-439ac7bba673";
const createdAt = "2026-11-08T00:00:00Z";
const attempt: AppData["attempts"][number] = {
  id, createdAt, kind: "memo", correct: true, trainingMode: "recognition",
  durationMs: 1000, targets: 4, accuracy: 0.75,
};
const solve: AppData["solves"][number] = {
  id, createdAt, scramble: "R U F", result: "success", memoMs: 1000,
  executionMs: 2000, totalMs: 3000, edgeMemo: [], cornerMemo: [],
  cycleBreaks: { edges: [], corners: [] },
};
const file = (version: number, data: AppData) => JSON.stringify({ version, data });

describe("backup history identity", () => {
  it.each([false, true])("rejects conflicting attempt and solve rows (reversed: %s)", (reverse) => {
    const attempts = [attempt, { ...attempt, durationMs: 9999 }];
    const solves = [solve, { ...solve, deleted: true }];
    if (reverse) {
      attempts.reverse();
      solves.reverse();
    }
    expect(() => parseBackup(file(3, { ...emptyData(), attempts }))).toThrow(
      `conflicting attempt records for ID ${id}`,
    );
    expect(() => parseBackup(file(3, { ...emptyData(), solves }))).toThrow(
      `conflicting solve records for ID ${id}`,
    );
  });

  it("rejects differences even when schema projection would hide them", () => {
    const withUnknownField = { ...attempt, unrecognizedSnapshot: ["A", "B"] };
    expect(() => parseBackup(file(3, {
      ...emptyData(), attempts: [attempt, withUnknownField],
    }))).toThrow(`conflicting attempt records for ID ${id}`);
  });

  it.each([1, 2, 3])("deduplicates identical histories in v%s", (version) => {
    const reorderedAttempt = Object.fromEntries(Object.entries(attempt).reverse());
    const data = parseBackup(file(version, {
      ...emptyData(),
      attempts: [attempt, reorderedAttempt as typeof attempt],
      solves: [solve, structuredClone(solve)],
    }));
    expect(data.attempts).toEqual([attempt]);
    expect(data.solves).toEqual([solve]);
  });

  it("rejects an unknown version instead of treating it as legacy data", () => {
    expect(() => parseBackup(file(4, emptyData()))).toThrow("Unsupported backup version");
  });

  it("legacy bytes do not carry local attempt deletions into fresh recovery", () => {
    const original = { ...emptyData(), attempts: [attempt] };
    const source = { ...original, attempts: [] };
    const tombstones = trackDeletions({}, diffSyncChanges(original, source, createdAt));
    const olderBytes = file(3, original);
    const afterDeletion = parseBackup(JSON.stringify(buildBackup(source)));
    const legacyReplay = mergeData(afterDeletion, parseBackup(olderBytes)).data;
    // This reproduces the unresolved portable gap without changing the archived probe.
    expect(legacyReplay.attempts).toEqual([attempt]);
    expect(tombstones[`attempt:${id}`]).toBe(createdAt);
    expect(applyTombstones(legacyReplay, tombstones).attempts).toEqual([]);
    expect(() => mergeBackup(afterDeletion, parseBackup(olderBytes), "keep-mine")).toThrow("unknown deletion status");
  });

  it.each<MergeStrategy>(["keep-mine", "prefer-backup", "replace"])(
    "preflights existing history for %s and accepts exact replay",
    (strategy) => {
      const current = { ...emptyData(), attempts: [attempt], solves: [solve] };
      const original = structuredClone(current);
      expect(() => mergeBackup(current, {
        ...emptyData(), attempts: [{ ...attempt, durationMs: 9999 }],
      }, strategy)).toThrow(`workspace attempt for ID ${id}`);
      expect(() => mergeBackup(current, {
        ...emptyData(), solves: [{ ...solve, deleted: true }],
      }, strategy)).toThrow(`workspace solve for ID ${id}`);
      expect(current).toEqual(original);
      if (strategy === "replace") {
        expect(() => mergeBackup(current, structuredClone(current), strategy)).toThrow("separate local workspace");
        return;
      }
      const replay = mergeBackup(current, structuredClone(current), strategy);
      expect(replay.attempts).toEqual([attempt]);
      expect(replay.solves).toEqual([solve]);
    },
  );
});
