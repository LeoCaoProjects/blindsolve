import { describe, expect, it } from "vitest";
import { guidedTiming, nextGuidedPhase } from "./guidedSolve";

describe("Guided Solve lifecycle", () => {
  it("advances exactly once for each deliberate action", () => {
    expect(nextGuidedPhase("idle", "start")).toBe("memo");
    expect(nextGuidedPhase("memo", "space")).toBe("execution");
    expect(nextGuidedPhase("execution", "space")).toBe("report");
    expect(nextGuidedPhase("report", "solved")).toBe("review");
    expect(nextGuidedPhase("review", "next")).toBe("idle");
  });

  it("ignores repeat/out-of-phase actions", () => {
    expect(nextGuidedPhase("execution", "start")).toBe("execution");
    expect(nextGuidedPhase("report", "space")).toBe("report");
    expect(nextGuidedPhase("review", "solved")).toBe("review");
  });

  it("derives all splits from high-resolution timestamps without cumulative rounding", () => {
    expect(guidedTiming(100.25, 1434.75, 4001.5)).toEqual({
      memoMs: 1334.5,
      executionMs: 2566.75,
      totalMs: 3901.25,
    });
  });
});
