import { describe, expect, it } from "vitest";
import { createSpeffzScheme } from "../../domain/bld/speffz";
import type { SolveRecord } from "../../lib/repository";
import { solveFromStore } from "./AppDataContext";

function record(): SolveRecord {
  return {
    id: "solve-1",
    scramble: "R U",
    memoMs: 1_000,
    executionMs: 2_000,
    totalMs: 3_000,
    result: "success",
    edgeMemo: ["C"],
    cornerMemo: [],
    cycleBreaks: { edges: [], corners: [] },
    createdAt: "2026-10-09T00:00:00.000Z",
    schemeSnapshot: createSpeffzScheme(),
    memoSnapshot: { corners: [], edges: [] },
  };
}

describe("historical solve memo representations", () => {
  it("keeps new raw snapshot fields canonical while displaying explicit execution fields", () => {
    const stored = record();
    stored.memoSnapshot!.edges = [
      {
        firstStickerId: "U:UF",
        firstToken: stored.schemeSnapshot!.stickers["U:UF"].label,
        firstExecutionStickerId: "D:DB",
        firstExecutionToken: stored.schemeSnapshot!.stickers["D:DB"].label,
        mnemonic: "word",
      },
    ];

    const solve = solveFromStore(stored, 1);
    expect(stored.memoSnapshot!.edges[0].firstStickerId).toBe("U:UF");
    expect(solve.memo.targetRepresentation).toBe("m2-execution");
    expect(solve.memo.edges[0]).toEqual({
      pair: stored.schemeSnapshot!.stickers["D:DB"].label,
      word: "word",
    });
  });

  it("loads legacy snapshots whose token was execution-transformed but sticker id stayed raw", () => {
    const stored = record();
    stored.memoSnapshot!.edges = [
      {
        firstStickerId: "U:UF",
        firstToken: stored.schemeSnapshot!.stickers["D:DB"].label,
        mnemonic: "legacy word",
      },
    ];

    const solve = solveFromStore(stored, 1);
    expect(solve.memo.targetRepresentation).toBe("m2-execution");
    expect(solve.memo.edges[0].pair).toBe(
      stored.schemeSnapshot!.stickers["D:DB"].label,
    );
  });

  it("does not infer execution representation for unchanged raw snapshots", () => {
    const stored = record();
    stored.memoSnapshot!.edges = [
      {
        firstStickerId: "U:UF",
        firstToken: stored.schemeSnapshot!.stickers["U:UF"].label,
        mnemonic: "raw word",
      },
    ];

    const solve = solveFromStore(stored, 1);
    expect(solve.memo.targetRepresentation).toBe("raw");
    expect(solve.memo.edges[0].pair).toBe(
      stored.schemeSnapshot!.stickers["U:UF"].label,
    );
  });
});
