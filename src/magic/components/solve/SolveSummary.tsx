import { Penalty } from "../../types/solve";
import { formatSolveDate } from "../../utils/time";
import { ResultControl } from "./ResultControl";
import { SolveTime } from "./SolveTime";
import { SplitMeter } from "./SplitMeter";

/** Extracted from WorkspaceSolveDetails at 050652b, before the Timer cleanup.
 * Preserve its typography, spacing, time/result rendering, split meter and controls.
 * Date punctuation uses the current comma formatter. Both inspectors share this header.
 */
export function SolveSummary({
  date,
  index,
  time,
  memoTime,
  penalty,
  onPenalty,
}: {
  date: string;
  index?: number;
  time: number;
  memoTime?: number;
  penalty: Penalty;
  onPenalty: (penalty: Penalty) => void;
}) {
  return (
    <section
      aria-label="Solve summary"
      className="flex h-full min-w-0 flex-col"
    >
      <div className="flex items-center justify-between">
        <p className="flex items-baseline gap-3 text-[12.5px] text-ink-3">
          {index !== undefined && (
            <span className="font-mono tnum">#{index}</span>
          )}
          <time dateTime={date}>{formatSolveDate(date)}</time>
        </p>
      </div>
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
      <ResultControl
        size="original"
        className="mt-auto self-start"
        value={penalty}
        onChange={onPenalty}
      />
    </section>
  );
}
