import { Penalty } from "../../types/solve";
import { formatSolveDate } from "../../utils/time";
import { ResultControl } from "./ResultControl";
import { SolveTime } from "./SolveTime";
import { SplitMeter } from "./SplitMeter";
import type { ReactNode } from "react";

/** Extracted from WorkspaceSolveDetails at 050652b, before the Timer cleanup.
 * Preserve its typography, spacing, time/result rendering, split meter and controls.
 * Date punctuation uses the current comma formatter. Both inspectors share this header.
 */
export function SolveSummary({
  date,
  time,
  memoTime,
  penalty,
  onPenalty,
  resultControl,
  metadata,
  resultOptions,
}: {
  date?: string;
  time: number;
  memoTime?: number;
  penalty: Penalty;
  onPenalty: (penalty: Penalty) => void;
  resultControl?: ReactNode;
  metadata?: ReactNode;
  resultOptions?: { value: Penalty; label: string }[];
}) {
  return (
    <section
      aria-label="Solve summary"
      className="flex h-full min-w-0 flex-col"
    >
      {date && (
        <div className="flex items-center justify-between">
          <p className="flex items-baseline gap-3 text-[12.5px] text-ink-3">
            <time dateTime={date}>{formatSolveDate(date)}</time>
          </p>
        </div>
      )}
      <SolveTime
        time={time}
        penalty={penalty}
        className="mt-3 font-timer text-[clamp(38px,6.5vh,60px)] font-extralight leading-none tracking-[-0.05em] text-ink"
      />
      {memoTime !== undefined && (
        <SplitMeter
          memo={memoTime}
          total={time}
          showLabels
          className="mt-[clamp(10px,2vh,20px)] w-full max-w-[280px]"
        />
      )}
      {metadata}
      {resultControl ?? (
        <ResultControl
          size="original"
          className="mt-auto self-start"
          value={penalty}
          onChange={onPenalty}
          options={resultOptions}
        />
      )}
    </section>
  );
}
