import React from "react";
import { TrainingSession } from "../../../hooks/useTrainingSession";
import { targetAccuracyForResults } from "../../../utils/training";
import { formatTimePerTarget } from "../../../utils/time";
import { PairDiff } from "./PairDiff";
import { ReviewHeader, ReviewPanel } from "./ReviewPanel";
import { SolveSummary } from "../../solve/SolveSummary";
import { SolveDetailsActions } from "../../solve/SolveDetailsShell";

const LABEL = { corners: "Corners", edges: "Edges" } as const;

/** Memo's result surface with Trace timing/targets and no word-editing section. */
export function TraceReview({ t }: { t: TrainingSession }) {
  const completed = t.history.find(
    (attempt) => attempt.id === t.reviewAttemptId,
  );
  const rawTime = completed?.ms ?? t.elapsed.total;
  const targets = completed?.targets ?? t.targets;
  const accuracy = targetAccuracyForResults(t.results);
  const timePerTarget = formatTimePerTarget(rawTime, targets);
  return (
    <ReviewPanel
      label="Trace Sprint review"
      onNext={t.next}
      onClose={t.next}
      footer={
        <SolveDetailsActions
          onClose={t.next}
          closeLabel="Close"
          actionClassName="min-w-[84px] justify-center"
          onDelete={() => {
            if (completed) t.removeAttempt(completed.id);
            t.next();
          }}
          deleteLabel="Delete attempt"
        />
      }
      header={
        <ReviewHeader>
          <SolveSummary
            date={completed?.createdAt}
            time={rawTime}
            penalty={(completed?.correct ?? t.allCorrect) ? "ok" : "dnf"}
            onPenalty={() => {}}
            resultControl={<></>}
            metadata={
              <dl
                aria-label="Trace statistics"
                className="mt-[clamp(10px,2vh,20px)] flex flex-wrap gap-6"
              >
                {[
                  ["Targets", `${accuracy.correct}/${accuracy.total}`],
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
          />
        </ReviewHeader>
      }
    >
      <div className="grid gap-7">
        {t.results.map((g) => (
          <PairDiff
            key={g.piece}
            result={g}
            label={LABEL[g.piece]}
            keepComparison
            quietErrors
            hideStatusIcon
          />
        ))}
      </div>
    </ReviewPanel>
  );
}
