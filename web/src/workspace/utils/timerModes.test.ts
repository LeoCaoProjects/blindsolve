import { describe, expect, it } from "vitest";
import { emptyData, type SolveRecord } from "../../data/model";
import { parseBackup } from "../../data/backup";
import { diffSyncChanges, syncSnapshotEnvelope } from "../../data/repository";
import { applySolveViews, solveFromStore } from "../contexts/AppDataContext";
import { modeOf, solvesForMode, timerCategory } from "./timerModes";
const make = (
  timerMode?: SolveRecord["timerMode"],
  sessionId?: string,
): SolveRecord => ({
  id: crypto.randomUUID(),
  scramble: "R U",
  memoMs: 1000,
  executionMs: 2000,
  totalMs: 3000,
  result: "success",
  edgeMemo: [],
  cornerMemo: [],
  cycleBreaks: { edges: [], corners: [] },
  createdAt: "2026-11-05T00:00:00.000Z",
  ...(timerMode ? { timerMode } : {}),
  ...(sessionId ? { sessionId } : {}),
});
describe("fixed Timer mode compatibility", () => {
  it("preserves single-piece categories through older clients without reclassifying legacy sessions", () => {
    expect(modeOf(make(undefined, timerCategory("edges")))).toBe("edges");
    expect(modeOf(make(undefined, timerCategory("corners")))).toBe("corners");
    expect(modeOf(make(undefined, "old-custom-session"))).toBe("3bld");
    expect(timerCategory("3bld")).toBe("today");
  });
  it("includes every legacy session in 3BLD without rewriting records", () => {
    const legacy = [make(), make(undefined, "old-custom-session")];
    const original = JSON.stringify(legacy);
    const edges = make("edges"),
      corners = make("corners");
    const all = [...legacy, edges, corners, { ...make(), deleted: true }];
    expect(solvesForMode(all, "3bld")).toEqual(legacy);
    expect(solvesForMode(all, "edges")).toEqual([edges]);
    expect(solvesForMode(all, "corners")).toEqual([corners]);
    expect(JSON.stringify(legacy)).toBe(original);
    expect(modeOf(legacy[0])).toBe("3bld");
  });
  it("clears only explicitly viewed mode records and keeps deletion evidence", () => {
    const legacy = make(undefined, "old-session"),
      edges = make("edges"),
      corners = make("corners");
    const all = [legacy, edges, corners];
    const cleared = applySolveViews(
      all,
      [solveFromStore(edges, 1)],
      [],
      undefined,
    );
    expect(cleared[0]).toBe(legacy);
    expect(cleared[1].deleted).toBe(true);
    expect(cleared[2]).toBe(corners);
    const changes = diffSyncChanges(
      { ...emptyData(), solves: all },
      { ...emptyData(), solves: cleared },
    );
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      kind: "solve",
      recordId: edges.id,
      deleted: true,
      payload: null,
    });
  });
  it("round-trips new modes through backup and cloud hydration; legacy discriminator stays absent", () => {
    const legacy = make(),
      edges = make("edges"),
      corners = make("corners");
    const data = {
      ...emptyData(),
      solves: [legacy, edges, corners],
      activeTimerMode: "edges" as const,
    };
    const restored = parseBackup(JSON.stringify({ version: 3, data }));
    expect(restored.solves[0].timerMode).toBeUndefined();
    expect(restored.solves.slice(1).map(modeOf)).toEqual(["edges", "corners"]);
    const rows = diffSyncChanges(emptyData(), data).map((change) => ({
      kind: change.kind,
      record_id: change.recordId,
      payload: change.payload,
      deleted: change.deleted,
      updated_at: change.updatedAt,
    }));
    const remote = syncSnapshotEnvelope(rows, 4);
    expect(remote.data.activeTimerMode).toBe("edges");
    expect(remote.data.solves.map(modeOf).sort()).toEqual([
      "3bld",
      "corners",
      "edges",
    ]);
  });
  it("switching mode sends settings only and never reclassifies solve history", () => {
    const original = {
      ...emptyData(),
      solves: [make(undefined, "practice"), make("edges")],
    };
    expect(
      diffSyncChanges(original, {
        ...original,
        activeTimerMode: "corners",
      }).map((change) => change.kind),
    ).toEqual(["settings"]);
  });
});
