import type { TokenMark } from "../components/memo/SequenceView";
import { Piece } from "../types/solve";
import { chunkPairs, tokenize } from "./pairs";

export interface TrainGroup {
  piece: Piece;
  tokens: string[];
}

export interface GroupResult {
  piece: Piece;
  actual: string[];
  typed: string[];
  correct: boolean;
  typedMarks: TokenMark[];
  actualMarks: TokenMark[];
  wrong: number;
}

/** Position-by-position comparison of typed targets against the traced memo. */
export function compareGroups(
  groups: TrainGroup[],
  inputs: string[],
  vocabulary: string[],
): GroupResult[] {
  return groups.map((g, gi) => {
    const typed = tokenize(inputs[gi] ?? "", vocabulary);
    const len = Math.max(typed.length, g.tokens.length);
    const typedMarks: TokenMark[] = [];
    const actualMarks: TokenMark[] = [];
    let wrong = 0;
    for (let i = 0; i < len; i++) {
      const t = typed[i];
      const a = g.tokens[i];
      if (t !== undefined && a !== undefined) {
        typedMarks.push(t === a ? "ok" : "wrong");
        actualMarks.push(t === a ? "ok" : "missing");
        if (t !== a) wrong++;
      } else if (a !== undefined) {
        actualMarks.push("missing");
        wrong++;
      } else {
        typedMarks.push("extra");
        wrong++;
      }
    }
    return {
      piece: g.piece,
      actual: g.tokens,
      typed,
      correct: wrong === 0,
      typedMarks,
      actualMarks,
      wrong,
    };
  });
}

/** Count positions in the expected token sequence, not characters or mnemonic pairs. */
export function targetAccuracyForResults(results: GroupResult[]) {
  const total = results.reduce((sum, result) => sum + result.actual.length, 0);
  const correct = results.reduce(
    (sum, result) =>
      sum +
      result.actual.filter((token, index) => result.typed[index] === token)
        .length,
    0,
  );
  return { correct, total };
}

/** Existing persisted ratio; extra tokens still make an attempt incorrect. */
export function accuracyForResults(results: GroupResult[]): number {
  const { correct, total } = targetAccuracyForResults(results);
  return total ? correct / total : 1;
}

/** Old failures without a recorded ratio cannot reveal their correct-position count. */
export function attemptTargetAccuracy(attempt: {
  targets: number;
  accuracy?: number;
  correct: boolean;
}): string {
  const total = Number.isFinite(attempt.targets)
    ? Math.max(0, Math.trunc(attempt.targets))
    : 0;
  const ratio = attempt.accuracy;
  const correct =
    typeof ratio === "number" &&
    Number.isFinite(ratio) &&
    ratio >= 0 &&
    ratio <= 1
      ? Math.round(ratio * total)
      : attempt.correct
        ? total
        : null;
  return `${correct ?? "\u2014"}/${total} targets`;
}

/** Full letter pairs only — a trailing single target has no word slot. */
export function fullPairs(tokens: string[]): [string, string][] {
  return chunkPairs(tokens).filter((p) => p.length === 2) as [string, string][];
}

export function trailingTarget(tokens: string[]): string | null {
  return tokens.length % 2 === 1 ? tokens[tokens.length - 1] : null;
}
