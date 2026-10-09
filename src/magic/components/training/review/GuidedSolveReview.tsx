import React from "react";
import { TrainingSession } from "../../../hooks/useTrainingSession";
import { chunkPairs } from "../../../utils/pairs";
import { formatTime } from "../../../utils/time";
import { ScrambleText } from "../../solve/ScrambleText";
import { ReviewHeader, ReviewPanel } from "./ReviewPanel";
import { ReviewSummary } from "./ReviewSummary";

const LABEL = { corners: "Corners", edges: "Edges" } as const;

export function GuidedSolveReview({ t }: { t: TrainingSession }) {
  return (
    <ReviewPanel
      label="Guided Solve result"
      onNext={t.next}
      width={720}
      header={
        <ReviewHeader>
          <ReviewSummary
            time={formatTime(t.elapsed.total)}
            status={t.report === "solved" ? "correct" : "incorrect"}
            statusLabel={t.report === "solved" ? "Solved" : "DNF"}
            stats={[
              ["memo", formatTime(t.elapsed.memo)],
              ["execution", formatTime(t.elapsed.execution)],
              [
                "scope",
                t.filter === "both"
                  ? "All"
                  : t.filter === "corners"
                    ? "Corners"
                    : "Edges",
              ],
            ]}
          />
        </ReviewHeader>
      }
    >
      <ScrambleText
        scramble={t.scramble}
        animate={false}
        className="text-[15px] leading-[1.75] text-ink"
      />
      <div className="mt-7 grid gap-6 border-t border-line pt-6">
        {t.groups.map((group) => (
          <section
            key={group.piece}
            className="grid gap-3 md:grid-cols-[72px_minmax(0,1fr)]"
          >
            <h3 className="text-[12px] text-ink-3">{LABEL[group.piece]}</h3>
            <ol
              className="flex flex-wrap gap-x-6 gap-y-3"
              aria-label={`${LABEL[group.piece]} sequence`}
            >
              {chunkPairs(group.tokens).map((pair, index) => (
                <li
                  key={index}
                  className="flex gap-[0.25em] font-mono text-[17px] tracking-[0.1em] text-ink"
                >
                  {pair.map((token, tokenIndex) => (
                    <span key={tokenIndex}>{token}</span>
                  ))}
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </ReviewPanel>
  );
}
