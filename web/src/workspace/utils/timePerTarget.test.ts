import { describe, expect, it } from "vitest";
import { formatTimePerTarget } from "./time";

describe("completion time per target", () => {
  it("uses the existing centisecond display convention", () => {
    expect(formatTimePerTarget(12400, 8)).toBe("1.55");
    expect(formatTimePerTarget(12999, 8)).toBe("1.62");
  });
  it.each([
    [12400, 0],
    [12400, undefined],
    [undefined, 8],
    [NaN, 8],
    [Infinity, 8],
    [-1, 8],
    [12400, NaN],
    [12400, Infinity],
    [12400, -8],
    [12400, 1.5],
  ])("omits invalid totals/counts (%s, %s)", (total, targets) => {
    expect(formatTimePerTarget(total, targets)).toBeUndefined();
  });
});
