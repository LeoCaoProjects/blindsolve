import React, { useEffect } from "react";
import { Attempt, TrainingSession } from "../../../hooks/useTrainingSession";
import { isTypingTarget } from "../../../utils/keyboard";
import {
  SolveDetailsShell,
  DetailsSummaryBand,
} from "../../solve/SolveDetailsShell";
import { SolveSummary } from "../../solve/SolveSummary";
import { TrainingMemoView } from "../TrainingMemoView";
import { ScrambleText } from "../../solve/ScrambleText";
import { ResultControl } from "../../solve/ResultControl";
import { formatTimePerTarget } from "../../../utils/time";

/** Completion only: all reconstruction comes directly from the finished session. */
export function TrainingAttemptDetails({
  attempt,
  session,
}: {
  attempt: Attempt;
  session: TrainingSession;
}) {
  const onClose = session.next;
  const onResult = session.setExecResult;
  const timePerTarget = formatTimePerTarget(attempt.ms, session.targets);
  const onDelete = () => {
    session.removeAttempt(attempt.id);
    session.next();
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.defaultPrevented ||
        isTypingTarget(e.target) ||
        e.metaKey ||
        e.ctrlKey ||
        e.repeat
      )
        return;
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
      if (e.key === "Enter" && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault();
        onClose();
      }
      if (e.key.toLowerCase() === "s" || e.key === "1") onResult("solved");
      if (e.key.toLowerCase() === "d" || e.key === "2") onResult("dnf");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onResult]);
  return (
    <SolveDetailsShell
      label="Execution Sprint result"
      onClose={onClose}
      onDelete={onDelete}
      deleteLabel="Delete attempt"
      header={
        <DetailsSummaryBand cube={session.challenge.state}>
          <SolveSummary
            date={attempt.createdAt}
            time={attempt.ms}
            penalty={attempt.correct ? "ok" : "dnf"}
            onPenalty={(value) => onResult(value === "dnf" ? "dnf" : "solved")}
            metadata={
              <dl
                aria-label="Attempt counts"
                className="mt-[clamp(10px,2vh,20px)] flex gap-6"
              >
                {[
                  ["targets", session.targets],
                  ["pairs", session.pairCount],
                  ...(timePerTarget === undefined
                    ? []
                    : [["Time per target", timePerTarget]]),
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-[11px] text-ink-3">{label}</dt>
                    <dd className="mt-1 font-mono text-[14px] text-ink-2 tnum">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            }
            resultControl={
              <ResultControl
                size="original"
                className="mt-auto self-start"
                value={attempt.correct ? "ok" : "dnf"}
                options={[
                  { value: "ok", label: "Solved" },
                  { value: "dnf", label: "DNF" },
                ]}
                onChange={(value) =>
                  onResult(value === "dnf" ? "dnf" : "solved")
                }
              />
            }
          />
        </DetailsSummaryBand>
      }
    >
      <ScrambleText
        scramble={session.scramble}
        animate={false}
        className="text-[15px] leading-[1.75] text-ink"
      />
      <div className="mt-8 border-t border-line pt-7">
        <TrainingMemoView session={session} />
      </div>
    </SolveDetailsShell>
  );
}
