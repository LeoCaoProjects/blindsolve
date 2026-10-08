import type { TrainMode } from "../data/trainingModes";
import type { Challenge, ChallengeTargetSet, TrainFilter } from "./bld";
import type { TrainGroup } from "./training";

/**
 * Memo and tracing drills consume factual targets. Only Execution Sprint may
 * opt into the execution representation prepared for the same physical state.
 */
export function challengeTargetsForMode(
  challenge: Challenge,
  mode: TrainMode,
): ChallengeTargetSet {
  return mode === "exec" ? challenge.executionTargets : challenge.rawTargets;
}

export function orderedChallengeGroups(
  challenge: Challenge,
  mode: TrainMode,
  filter: TrainFilter,
  memoOrder: "corners-first" | "edges-first",
): TrainGroup[] {
  const targets = challengeTargetsForMode(challenge, mode);
  const order =
    memoOrder === "edges-first"
      ? (["edges", "corners"] as const)
      : (["corners", "edges"] as const);
  return order.flatMap((piece) => {
    if (piece === "corners" && filter === "edges") return [];
    if (piece === "edges" && filter === "corners") return [];
    return [{ piece, tokens: targets[piece].tokens }];
  });
}
