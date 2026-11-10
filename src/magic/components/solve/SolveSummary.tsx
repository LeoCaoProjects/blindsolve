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
  compact = false,
}: {
  compact?: boolean;
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
      className={
        compact
          ? "grid min-w-0 grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2"
          : "flex h-full min-w-0 flex-col"
      }
    >
      {date && (
        <div
          className={`flex items-center justify-between ${compact ? "col-span-2" : ""}`}
        >
          <p className="flex items-baseline gap-3 text-[12.5px] text-ink-3">
            <time dateTime={date}>{formatSolveDate(date)}</time>
          </p>
        </div>
      )}
      <SolveTime
        time={time}
        penalty={penalty}
        className={`font-timer font-extralight leading-none tracking-[-0.05em] text-ink ${compact ? "text-[38px]" : "mt-3 text-[clamp(38px,6.5vh,60px)]"}`}
      />
      {memoTime !== undefined && (
        <SplitMeter
          memo={memoTime}
          total={time}
          showLabels
          className={`w-full max-w-[280px] ${compact ? "col-span-2 row-start-3" : "mt-[clamp(10px,2vh,20px)]"}`}
        />
      )}
      {metadata}
      {resultControl ?? (
        <ResultControl
          size="original"
          className={compact ? "col-start-2 row-start-2" : "mt-auto self-start"}
          value={penalty}
          onChange={onPenalty}
          options={resultOptions}
        />
      )}
    </section>
  );
}
