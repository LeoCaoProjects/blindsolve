import { describe, expect, it } from "vitest";
import { accuracyForResults, compareGroups } from "./training";

describe("training accuracy", () => {
  it("never becomes negative when an answer contains extra and wrong targets", () => {
    const results = compareGroups(
      [{ piece: "edges", tokens: ["A", "B", "C", "D"] }],
      ["WXYZABCD"],
      ["A", "B", "C", "D", "W", "X", "Y", "Z"],
    );
    expect(results[0].wrong).toBeGreaterThan(results[0].actual.length);
    expect(accuracyForResults(results)).toBe(0);
  });

  it("scores correct target positions over the factual target count", () => {
    const results = compareGroups(
      [{ piece: "corners", tokens: ["A", "B", "C", "D"] }],
      ["ABXD"],
      ["A", "B", "C", "D", "X"],
    );
    expect(accuracyForResults(results)).toBe(0.75);
  });
});

import { targetAccuracyForResults, attemptTargetAccuracy } from "./training";
describe("Memo Recall target counts", () => {
  it("counts 18 of 21 individual target positions, including an odd last target", () => {
    const tokens = Array.from("ABCDEFGHIJKLMNOPQRSTU");
    const typed = [...tokens];
    typed[1] = "X";
    typed[8] = "X";
    typed[20] = "X";
    const results = compareGroups(
      [{ piece: "edges", tokens }],
      [typed.join("")],
      [...tokens, "X"],
    );
    expect(targetAccuracyForResults(results)).toEqual({
      correct: 18,
      total: 21,
    });
    expect(
      attemptTargetAccuracy({
        targets: 21,
        accuracy: accuracyForResults(results),
        correct: false,
      }),
    ).toBe("18/21 targets");
  });
  it("counts multi-character tokens once and missing positions as incorrect", () => {
    const results = compareGroups(
      [{ piece: "corners", tokens: ["AA", "BB", "CC"] }],
      ["AABB"],
      ["AA", "BB", "CC"],
    );
    expect(targetAccuracyForResults(results)).toEqual({ correct: 2, total: 3 });
  });
  it("extras make an attempt incorrect without changing the expected-position denominator", () => {
    const results = compareGroups(
      [{ piece: "edges", tokens: ["A", "B"] }],
      ["ABC"],
      ["A", "B", "C"],
    );
    expect(results[0].correct).toBe(false);
    expect(targetAccuracyForResults(results)).toEqual({ correct: 2, total: 2 });
  });
  it("does not invent a correct count for old failures without a saved ratio", () => {
    expect(attemptTargetAccuracy({ targets: 21, correct: false })).toBe(
      "—/21 targets",
    );
    expect(attemptTargetAccuracy({ targets: 21, correct: true })).toBe(
      "21/21 targets",
    );
  });
});
