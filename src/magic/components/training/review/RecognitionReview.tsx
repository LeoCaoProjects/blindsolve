import React from "react";
import type { Attempt } from "../../../hooks/useTrainingSession";
import { ReviewPanel, ReviewHeader } from "./ReviewPanel";
import { SolveSummary } from "../../solve/SolveSummary";
import { SolveDetailsActions } from "../../solve/SolveDetailsShell";
import { formatTimePerTarget } from "../../../utils/time";
import { attemptTargetAccuracy } from "../../../utils/training";

export function RecognitionReview({
  attempt,
  onClose,
  onDelete,
}: {
  attempt?: Attempt;
  onClose: () => void;
  onDelete: (id: string) => void;
}) {
  if (!attempt) return null;
  const answers = attempt.recognitionAnswers ?? [];
  return (
    <ReviewPanel
      label="Target Recognition result"
      onNext={onClose}
      onClose={onClose}
      footer={
        <SolveDetailsActions
          onClose={onClose}
          onDelete={() => {
            onDelete(attempt.id);
            onClose();
          }}
          deleteLabel="Delete attempt"
        />
      }
      header={
        <ReviewHeader>
          <SolveSummary
            date={attempt.createdAt}
            time={attempt.ms}
            penalty="ok"
            onPenalty={() => {}}
            resultControl={<></>}
            metadata={
              <dl className="mt-5 flex gap-6">
                {[
                  ["Accuracy", attemptTargetAccuracy(attempt)],
                  [
                    "Time per target",
                    formatTimePerTarget(attempt.ms, attempt.targets) ?? "—",
                  ],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-[11px] text-ink-3">{label}</dt>
                    <dd className="mt-1 font-mono text-[14px] text-ink-2">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            }
          />
        </ReviewHeader>
      }
    >
      <div className="grid grid-cols-[1fr_1fr_1fr] gap-x-6 border-b border-line pb-3 text-[12px] text-ink-3">
        <span>Piece</span>
        <span>Expected</span>
        <span>Entered</span>
      </div>
      {answers.length ? (
        answers.map((a, i) => (
          <div
            key={i}
            className={`grid grid-cols-[1fr_1fr_1fr] gap-x-6 border-b border-line py-3 text-[14px] ${a.expected === a.entered ? "text-ink-2" : "text-danger"}`}
          >
            <span className="text-ink-3">
              {a.piece === "edges" ? "Edge" : "Corner"}
            </span>
            <span className="font-mono">{a.expected}</span>
            <span className="font-mono">{a.entered}</span>
          </div>
        ))
      ) : (
        <p className="py-4 text-ink-3">
          Answer review unavailable for this attempt.
        </p>
      )}
    </ReviewPanel>
  );
}
