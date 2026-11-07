import React, { useMemo } from "react";
import { TrainingSession } from "../../hooks/useTrainingSession";
import { useAppData } from "../../contexts/AppDataContext";
import { chunkPairs, toTimerDb } from "../../utils/pairs";
import { SolveMemo } from "../../types/solve";
import { SolveMemoView } from "../solve/SolveMemoView";

/** Render the existing live Training targets through Timer's reconstruction. */
export function useTrainingMemo(session: TrainingSession) {
  const { pairs } = useAppData();
  const db = useMemo(() => toTimerDb(pairs), [pairs]);
  const memo: SolveMemo = {
    edges: [],
    corners: [],
    edgeBreakAt: session.challenge.edgeBreaks[0],
    cornerBreakAt: session.challenge.cornerBreaks[0],
  };
  for (const group of session.groups) {
    memo[group.piece] = chunkPairs(group.tokens).map((tokens) => ({
      pair: tokens.join(""),
      word:
        tokens.length === 2
          ? (session.wordFor(tokens[0], tokens[1], group.piece) ?? "")
          : "",
    }));
  }
  return { memo, db };
}

export function TrainingMemoView({ session }: { session: TrainingSession }) {
  const { memo, db } = useTrainingMemo(session);
  return <SolveMemoView memo={memo} db={db} />;
}
