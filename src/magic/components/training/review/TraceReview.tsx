import React from "react";
import { TrainingSession } from "../../../hooks/useTrainingSession";
import { formatTime } from "../../../utils/time";
import { PairDiff } from "./PairDiff";
import { correctTargets } from "./RecallReview";
import { ReviewHeader, ReviewPanel } from "./ReviewPanel";
import { ReviewSummary } from "./ReviewSummary";
import { M2ParityNotice } from "../../memo/M2ParityNotice";

const LABEL = { corners: "Corners", edges: "Edges" } as const;

/** Trace Sprint: time and accuracy, then the aligned diff. Words are not the point here. */
export function TraceReview({ t }: { t: TrainingSession }) {
  const ok = correctTargets(t);
  return (
    <ReviewPanel
      label="Trace Sprint review"
      onNext={t.next}
      header={
        <ReviewHeader>
          <ReviewSummary
            time={formatTime(t.elapsed.total)}
            status={t.allCorrect ? "correct" : "incorrect"}
            stats={[
              ["targets", `${ok} / ${t.targets}`],
              [
                "accuracy",
                `${Math.round((ok / Math.max(1, t.targets)) * 100)}%`,
              ],
              [
                "per target",
                formatTime(t.elapsed.total / Math.max(1, t.targets)),
              ],
            ]}
          />
        </ReviewHeader>
      }
    >
      <div className="grid gap-7">
        {t.results.map((g) => (
          <PairDiff key={g.piece} result={g} label={LABEL[g.piece]} />
        ))}
      </div>
      {t.challenge.hasM2Parity && <M2ParityNotice className="mt-5" />}
    </ReviewPanel>
  );
}
