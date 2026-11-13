import { describe, expect, it } from "vitest";
import { createSpeffzScheme } from "../../domain/bld/speffz";
import { emptyData, type SolveRecord } from "../../lib/repository";
import { pairKey } from "../utils/pairs";
import {
  pairsFromStore,
  setupFromStore,
  solveFromStore,
  applySolveViews,
} from "./AppDataContext";

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

describe("legacy settings compatibility", () => {
  it("uses effective OP without rewriting persisted 3-style values", () => {
    const data = emptyData();
    data.scheme.edgeMethod = "3style";
    data.scheme.cornerMethod = "3style";
    expect(setupFromStore(data)).toMatchObject({
      edgeMethod: "op",
      cornerMethod: "op",
    });
    expect(data.scheme.edgeMethod).toBe("3style");
    expect(data.scheme.cornerMethod).toBe("3style");
  });
});

describe("legacy vocabulary compatibility", () => {
  const withPair = (
    sharing: "shared" | "separate",
    edgeWords: string[],
    cornerWords: string[],
  ) => {
    const data = emptyData();
    data.pairSharing = sharing;
    const find = (type: "edge" | "corner", label: string) =>
      Object.values(data.scheme.stickers).find(
        (s) => s.pieceType === type && s.label === label,
      )!;
    const add = (type: "edge" | "corner", words: string[]) => {
      if (!words.length) return;
      const a = find(type, "A"),
        b = find(type, "B");
      data.pairs[`${a.id}|${b.id}`] = {
        id: `${type}-pair`,
        firstStickerId: a.id,
        secondStickerId: b.id,
        firstToken: "A",
        secondToken: "B",
        primaryMnemonic: words[0],
        updatedAt: "2026-01-01T00:00:00.000Z",
      };
    };
    add("edge", edgeWords);
    add("corner", cornerWords);
    return { data, entry: pairsFromStore(data)[pairKey("A", "B")] };
  };
  it("collapses identical effective words to shared", () => {
    expect(withPair("shared", ["Apple"], ["Apple"]).entry).toEqual({
      shared: ["Apple"],
    });
  });
  it("keeps a lone one-vocabulary record shared", () => {
    expect(withPair("shared", ["Apple"], []).entry).toEqual({
      shared: ["Apple"],
    });
  });
  it("preserves separate vocabularies as shared plus override", () => {
    expect(withPair("separate", ["Apple"], ["Anchor"]).entry).toEqual({
      shared: ["Apple"],
      corners: ["Anchor"],
    });
  });
  it("preserves one-sided separate records", () => {
    expect(withPair("separate", ["Arrow"], []).entry).toEqual({
      shared: [],
      edges: ["Arrow"],
    });
    expect(withPair("separate", [], ["Castle"]).entry).toEqual({
      shared: [],
      corners: ["Castle"],
    });
  });
});

describe("Timer writes only intended changes", () => {
  it("does not retimestamp the rest of a session when deleting one solve", () => {
    const first = record();
    const second = { ...record(), id: "solve-2" };
    const before = [solveFromStore(first, 2), solveFromStore(second, 1)];
    const result = applySolveViews(
      [first, second],
      before,
      [before[1]],
      "today",
    );
    expect(result[0].deleted).toBe(true);
    expect(result[1]).toBe(second);
  });
  it("does not delete a newly hydrated solve absent from an older UI snapshot", () => {
    const first = record();
    const incoming = { ...record(), id: "newly-hydrated" };
    const result = applySolveViews(
      [first, incoming],
      [solveFromStore(first, 1)],
      [],
      "today",
    );
    expect(result[0].deleted).toBe(true);
    expect(result[1]).toBe(incoming);
  });
});
