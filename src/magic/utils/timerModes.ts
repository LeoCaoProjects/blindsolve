import type { Piece } from "../types/solve";
export type TimerMode = "3bld" | "edges" | "corners";
export const TIMER_MODES: { value: TimerMode; label: string }[] = [
  { value: "3bld", label: "3BLD" },
  { value: "edges", label: "Edges" },
  { value: "corners", label: "Corners" },
];
// Reserved wire categories keep single-piece records out of old clients' Today
// lists, and survive older backup parsers which omit the explicit discriminator.
export const timerCategory = (mode: TimerMode) =>
  mode === "3bld" ? "today" : `blindsolve:timer:${mode}`;
export const modeOf = (solve: {
  timerMode?: TimerMode;
  sessionId?: string;
}): TimerMode =>
  solve.timerMode ??
  (solve.sessionId === timerCategory("edges")
    ? "edges"
    : solve.sessionId === timerCategory("corners")
      ? "corners"
      : "3bld");
export const solvesForMode = <
  T extends { timerMode?: TimerMode; deleted?: boolean },
>(
  solves: T[],
  mode: TimerMode,
): T[] => solves.filter((solve) => !solve.deleted && modeOf(solve) === mode);
export const timerPieces = (mode: TimerMode = "3bld"): Piece[] =>
  mode === "3bld" ? ["corners", "edges"] : [mode];
