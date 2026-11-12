import type { ReactNode } from "react";
import type { TimerPhase } from "../../hooks/useTimer";
import { CompactTrainingTimer } from "./CompactTrainingTimer";

/** One compact clock/phase/working-area geometry for active Training modes. */
export function TrainingTimedStage({
  value,
  phase,
  label,
  cue,
  children,
}: {
  value: number;
  phase: TimerPhase;
  label?: string;
  cue?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="scroll-quiet h-full min-h-0 overflow-y-auto py-2 md:pl-14">
      <div
        data-training-timed-stage
        className="grid h-full grid-rows-[minmax(min-content,27%)_auto_minmax(16px,1fr)]"
      >
        <div className="self-end [container-type:inline-size]">
          <div className="relative h-[clamp(34px,6.5vh,60px)]">
            <CompactTrainingTimer value={value} phase={phase} label={label} />
          </div>
          {cue ?? (
            <p className="mt-3 text-[13px] text-ink-3" aria-hidden>
              {"\u00a0"}
            </p>
          )}
        </div>
        <div
          data-training-targets
          className="mt-[clamp(18px,4.5vh,44px)] grid gap-[clamp(18px,4.5vh,40px)]"
        >
          {children}
        </div>
      </div>
    </div>
  );
}
