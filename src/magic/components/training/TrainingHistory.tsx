import { RecognitionReview } from "./review/RecognitionReview";
import React, { useMemo, useState } from "react";
import { VirtualHistory } from "../common/VirtualHistory";
import { TrainingSession } from "../../hooks/useTrainingSession";
import { attemptTargetAccuracy } from "../../utils/training";
import { formatTime } from "../../utils/time";
import { RowDelete } from "../common/HistoryHeader";
import { SessionReadout } from "../practice/SessionReadout";
import { WORKSPACE_HISTORY_ROW } from "../workspace/historyStyles";

/** Training data in the same readout and row family as Timer solves. */
export function TrainingHistory({ t }: { t: TrainingSession }) {
  const [opened, setOpened] = useState<string | null>(null);
  const h = t.history;
  const n = h.length;
  const { mean, correct } = useMemo(
    () => ({
      mean: n ? h.reduce((sum, attempt) => sum + attempt.ms, 0) / n : 0,
      correct: h.filter((attempt) => attempt.correct).length,
    }),
    [h, n],
  );
  const cells: [string, string][] = [
    ["attempts", String(n)],
    [
      t.mode === "exec" || t.mode === "guided" ? "solved" : "correct",
      `${correct}/${n}`,
    ],
    [
      t.mode === "recognition"
        ? "mean time"
        : t.mode === "recall"
          ? "mean memo"
          : t.mode === "trace"
            ? "mean trace"
            : t.mode === "guided"
              ? "mean total"
              : "mean exec",
      n ? formatTime(mean) : "—",
    ],
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {opened && t.mode === "recognition" && (
        <RecognitionReview
          attempt={h.find((a) => a.id === opened)}
          onClose={() => setOpened(null)}
          onDelete={t.removeAttempt}
        />
      )}
      <SessionReadout cells={cells} />
      <VirtualHistory
        label="Attempts"
        items={h}
        rowHeight={36}
        empty="No attempts yet"
        renderItem={(a, i) => (
          <>
            <div
              role={t.mode === "recognition" ? "button" : undefined}
              tabIndex={t.mode === "recognition" ? 0 : undefined}
              onClick={() => t.mode === "recognition" && setOpened(a.id)}
              onKeyDown={(e) => {
                if (
                  t.mode === "recognition" &&
                  (e.key === "Enter" || e.key === " ")
                ) {
                  e.preventDefault();
                  e.stopPropagation();
                  setOpened(a.id);
                }
              }}
              data-attempt-row
              className={`${WORKSPACE_HISTORY_ROW} cursor-default grid-cols-[30px_1fr_auto] pr-10`}
            >
              <span
                className={`font-mono text-[10.5px] tnum ${i === 0 ? "text-accent" : "text-ink-3"}`}
              >
                {t.mode === "recognition" ? "" : n - i}
              </span>
              <span
                className={`font-mono text-[14.5px] tnum ${i === 0 ? "text-ink" : "text-ink-2"}`}
              >
                {!a.correct && t.mode !== "recognition"
                  ? "DNF"
                  : formatTime(a.ms)}
              </span>
              <span className="font-mono text-[11px] text-ink-3 tnum">
                {t.mode === "recognition"
                  ? attemptTargetAccuracy(a)
                  : t.mode === "recall"
                    ? attemptTargetAccuracy(a)
                    : t.mode === "guided" || t.mode === "exec"
                      ? `${a.pairs ?? 0} pairs`
                      : `${a.targets} targets`}
              </span>
            </div>
            <RowDelete
              label={`Delete attempt ${n - i}`}
              onClick={() => t.removeAttempt(a.id)}
            />
          </>
        )}
      />
    </div>
  );
}
