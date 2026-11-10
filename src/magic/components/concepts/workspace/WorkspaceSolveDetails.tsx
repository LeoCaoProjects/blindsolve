import React, { useCallback, useMemo } from "react";
import {
  SolveDetailsShell,
  DetailsSummaryBand,
} from "../../solve/SolveDetailsShell";
import { useDetailsKeys } from "../../../hooks/useDetailsKeys";
import { LetterPairDb, Penalty, Solve } from "../../../types/solve";
import { stateFromScramble } from "../../../utils/cube";
import { SolveMemoSection } from "../../solve/SolveMemoSection";

import { SolveSummary } from "../../solve/SolveSummary";

interface Props {
  solve: Solve;
  db: LetterPairDb;
  onClose: () => void;
  onPenalty: (id: string, p: Penalty) => void;
  onDelete: (id: string) => void;
  label?: string;
  deleteLabel?: string;
  resultOptions?: { value: Penalty; label: string }[];
}

export function WorkspaceSolveDetails({
  solve,
  db,
  onClose,
  onPenalty,
  onDelete,
  label = `Solve ${solve.index}`,
  deleteLabel = "Delete solve",
  resultOptions,
}: Props) {
  const setPenalty = useCallback(
    (p: Penalty) => onPenalty(solve.id, p),
    [onPenalty, solve.id],
  );
  const shortcuts = useMemo(
    () => resultOptions?.map((option) => option.value),
    [resultOptions],
  );
  useDetailsKeys(onClose, setPenalty, shortcuts);
  const cube = useMemo(
    () => stateFromScramble(solve.scramble),
    [solve.scramble],
  );

  return (
    <SolveDetailsShell
      label={label}
      onClose={onClose}
      onDelete={() => onDelete(solve.id)}
      deleteLabel={deleteLabel}
      header={
        <DetailsSummaryBand cube={cube}>
          <SolveSummary
            date={solve.date}
            time={solve.time}
            memoTime={solve.memoTime}
            penalty={solve.penalty}
            onPenalty={setPenalty}
            resultOptions={resultOptions}
          />
        </DetailsSummaryBand>
      }
    >
      <SolveMemoSection scramble={solve.scramble} memo={solve.memo} db={db} />
    </SolveDetailsShell>
  );
}
