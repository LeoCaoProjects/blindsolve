export type GuidedPhase = "idle" | "memo" | "execution" | "report" | "review";
export type GuidedEvent = "start" | "space" | "solved" | "dnf" | "next";

/** One event advances at most one lifecycle edge. Invalid/repeated events are no-ops. */
export function nextGuidedPhase(
  phase: GuidedPhase,
  event: GuidedEvent,
): GuidedPhase {
  if (phase === "idle" && event === "start") return "memo";
  if (phase === "memo" && event === "space") return "execution";
  if (phase === "execution" && event === "space") return "report";
  if (phase === "report" && (event === "solved" || event === "dnf"))
    return "review";
  if (phase === "review" && event === "next") return "idle";
  return phase;
}

export function guidedTiming(
  memoStart: number,
  executionStart: number,
  executionEnd: number,
) {
  const memoMs = Math.max(0, executionStart - memoStart);
  const executionMs = Math.max(0, executionEnd - executionStart);
  return { memoMs, executionMs, totalMs: executionEnd - memoStart };
}
