import React from "react";
import { TrainingSession } from "../../hooks/useTrainingSession";
import { formatTime } from "../../utils/time";
import { SequenceView } from "../memo/SequenceView";

const LABEL = { corners: "Corners", edges: "Edges" } as const;

/** Guided Solve keeps one immutable challenge while presentation moves memo -> execution -> report. */
export function GuidedSolveWorkspace({ t }: { t: TrainingSession }) {
  if (t.phase === "report") {
    return (
      <div className="flex h-full flex-col items-start justify-center md:pl-14">
        <p className="font-timer text-[clamp(42px,8vh,76px)] font-extralight tracking-[-0.04em] text-ink">
          {formatTime(t.elapsed.total)}
        </p>
        <p className="mt-3 text-[13px] text-ink-3">Did you solve the cube?</p>
        <div className="mt-5 flex gap-2" role="group" aria-label="Result">
          <ResultButton
            label="Solved"
            onClick={() => t.finishGuided("solved")}
          />
          <ResultButton
            label="DNF"
            onClick={() => t.finishGuided("dnf")}
            quiet
          />
        </div>
      </div>
    );
  }

  if (t.phase === "execution") {
    return (
      <div className="flex h-full flex-col items-start justify-center md:pl-14">
        <p
          role="timer"
          className="font-timer text-[clamp(42px,8vh,76px)] font-extralight tracking-[-0.04em] text-ink-2"
        >
          {formatTime(t.elapsed.total)}
        </p>
        <p className="mt-5 text-[clamp(26px,4vw,44px)] font-light text-ink">
          Solving
        </p>
      </div>
    );
  }

  return (
    <div className="scroll-quiet h-full min-h-0 overflow-y-auto py-2 md:pl-14">
      <p
        role="timer"
        aria-live="off"
        className="font-timer text-[clamp(34px,6.5vh,60px)] font-extralight leading-none tracking-[-0.04em] text-ink-2"
      >
        {formatTime(t.elapsed.memo)}
      </p>
      <div className="mt-[clamp(18px,4.5vh,44px)] grid gap-[clamp(18px,4.5vh,40px)]">
        {t.groups.map((group) => (
          <section key={group.piece}>
            <h2 className="mb-3 text-[12px] text-ink-3">
              {LABEL[group.piece]}
            </h2>
            <SequenceView tokens={group.tokens} size="xl" />
          </section>
        ))}
      </div>
    </div>
  );
}

function ResultButton({
  label,
  onClick,
  quiet = false,
}: {
  label: string;
  onClick: () => void;
  quiet?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-11 rounded-[4px] px-5 text-[13.5px] font-medium ${quiet ? "border border-line text-ink-2 hover:bg-hover" : "bg-ink text-bg hover:opacity-90"}`}
    >
      {label}
    </button>
  );
}
