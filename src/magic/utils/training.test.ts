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
