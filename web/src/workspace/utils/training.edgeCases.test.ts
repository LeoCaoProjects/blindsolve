import { describe, it, expect } from "vitest";
import { compareGroups, targetAccuracyForResults } from "./training";
const tokens = ["A", "B", "C", "D", "E", "F", "G"];
const vocabulary = [...tokens, "X", "AA", "BB"];
describe("Memo Recall neighbouring pairs and section edge cases", () => {
  it("checks all 128 correct/incorrect combinations across adjacent pairs and an odd final letter", () => {
    for (let mask = 0; mask < 128; mask++) {
      const typed = tokens.map((token, i) => (mask & (1 << i) ? "X" : token));
      const result = compareGroups(
        [{ piece: "edges", tokens }],
        [typed.join("")],
        vocabulary,
      )[0];
      expect(result.correct).toBe(mask === 0);
      expect(result.typedMarks).toEqual(
        typed.map((token, i) => (token === tokens[i] ? "ok" : "wrong")),
      );
      expect(targetAccuracyForResults([result])).toEqual({
        correct: typed.filter((t, i) => t === tokens[i]).length,
        total: 7,
      });
    }
  });
  it("rejects an insertion or deletion at every position, including either side of a pair boundary", () => {
    for (let i = 0; i <= tokens.length; i++) {
      const extra = [...tokens];
      extra.splice(i, 0, "X");
      expect(
        compareGroups(
          [{ piece: "corners", tokens }],
          [extra.join("")],
          vocabulary,
        )[0].correct,
      ).toBe(false);
      if (i < tokens.length) {
        const missing = [...tokens];
        missing.splice(i, 1);
        expect(
          compareGroups(
            [{ piece: "corners", tokens }],
            [missing.join("")],
            vocabulary,
          )[0].correct,
        ).toBe(false);
      }
    }
  });
  for (const corners of ["", "AB", "AX", "ABA"])
    for (const edges of ["", "CD", "XD", "CDD"])
      it(`keeps sections independent: corners ${corners || "empty"}, edges ${edges || "empty"}`, () => {
        const result = compareGroups(
          [
            { piece: "corners", tokens: ["A", "B"] },
            { piece: "edges", tokens: ["C", "D"] },
          ],
          [corners, edges],
          vocabulary,
        );
        expect(result.map((g) => g.correct)).toEqual([
          corners === "AB",
          edges === "CD",
        ]);
        expect(targetAccuracyForResults(result).total).toBe(4);
      });
  it("handles missing input arrays, solved/empty sections and extras without NaN", () => {
    const groups = [
      { piece: "corners" as const, tokens: [] },
      { piece: "edges" as const, tokens: ["A"] },
    ];
    const result = compareGroups(groups, [], vocabulary);
    expect(result.map((g) => g.correct)).toEqual([true, false]);
    expect(targetAccuracyForResults(result)).toEqual({ correct: 0, total: 1 });
    expect(
      compareGroups([{ piece: "edges", tokens: [] }], ["A"], vocabulary)[0]
        .correct,
    ).toBe(false);
  });
  it("keeps repeated letters and multi-character targets positional", () => {
    const groups = [{ piece: "corners" as const, tokens: ["AA", "BB", "AA"] }];
    expect(compareGroups(groups, ["AA|BB|AA"], vocabulary)[0].correct).toBe(
      true,
    );
    const wrong = compareGroups(groups, ["BB|AA|AA"], vocabulary);
    expect(wrong[0].correct).toBe(false);
    expect(targetAccuracyForResults(wrong)).toEqual({ correct: 1, total: 3 });
  });
});
