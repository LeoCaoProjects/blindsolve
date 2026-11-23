import React, { useEffect, useRef, useState } from "react";
import { TrainingSession } from "../../../hooks/useTrainingSession";
import { Penalty, Solve } from "../../../types/solve";
import { storedTimerTimes } from "../../../utils/time";
import { useTrainingMemo } from "../TrainingMemoView";
import { WorkspaceSolveDetails } from "../../workspace/WorkspaceSolveDetails";
import { isTypingTarget, allowsReviewEnter } from "../../../utils/keyboard";

const RESULTS: { value: Penalty; label: string }[] = [
  { value: "ok", label: "OK" },
  { value: "dnf", label: "DNF" },
];

/** Report the physical result in the actual Timer inspector, without another screen.
 * Nothing extra is stored: Close confirms the existing finishGuided flow once. */
export function GuidedSolveReview({ t }: { t: TrainingSession }) {
  const [penalty, setPenalty] = useState<Penalty>(
    t.report === "dnf" ? "dnf" : "ok",
  );
  const [date] = useState(() => new Date().toISOString());
  const settled = useRef(false);
  const { memo, db } = useTrainingMemo(t);
  const timing = storedTimerTimes(t.elapsed.total, t.elapsed.memo);
  const solve: Solve = {
    id: `guided:${t.challengeId}`,
    index: t.history.length + 1,
    time: timing.totalMs,
    memoTime: timing.memoMs,
    penalty,
    scramble: t.scramble,
    date,
    memo,
  };
  const close = () => {
    if (settled.current) return;
    settled.current = true;
    if (t.phase === "report")
      t.finishGuided(penalty === "dnf" ? "dnf" : "solved");
    t.next();
  };
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.isComposing ||
        event.altKey ||
        event.repeat ||
        event.metaKey ||
        event.ctrlKey ||
        isTypingTarget(event.target)
      )
        return;
      if (document.querySelector('[role="alertdialog"]')) return;
      if (event.key.toLowerCase() === "s") setPenalty("ok");
      if (event.key.toLowerCase() === "d") setPenalty("dnf");
      if (
        event.key === "Enter" &&
        !event.shiftKey &&
        allowsReviewEnter(event.target)
      ) {
        event.preventDefault();
        close();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [close]);
  return (
    <WorkspaceSolveDetails
      solve={solve}
      db={db}
      label="Guided Solve result"
      deleteLabel="Delete attempt"
      resultOptions={RESULTS}
      onClose={close}
      onPenalty={(_, value) => setPenalty(value)}
      onDelete={() => {
        if (!settled.current) {
          settled.current = true;
          t.next();
        }
      }}
    />
  );
}
