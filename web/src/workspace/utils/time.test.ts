import { describe, expect, it } from "vitest";
import { formatSolveDate, sessionStats, storedTimerTimes } from "./time";
describe("Timer result presentation and persistence", () => {
  it.each([
    [12.4, 4.6],
    [12.6, 4.4],
    [3000.49, 1000.51],
    [3000.51, 1000.49],
  ])("preserves the integer split invariant for %f / %f", (total, memo) => {
    const times = storedTimerTimes(total, memo);
    expect(times.totalMs).toBe(Math.round(total));
    expect(times.memoMs).toBe(Math.round(memo));
    expect(times.memoMs + times.executionMs).toBe(times.totalMs);
    expect(times.executionMs).toBeGreaterThanOrEqual(0);
  });
  it("uses a comma in solve dates and a dash for empty mode best time", () => {
    expect(formatSolveDate("2026-10-25T02:00:00.000Z")).toMatch(
      /2026, \d\d:\d\d/,
    );
    expect(sessionStats([]).best).toBe("—");
  });
});
