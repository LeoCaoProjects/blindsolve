import { Penalty } from "../../types/solve";
import { formatSolveDate, formatTime } from "../../utils/time";
import { ResultControl } from "./ResultControl";

export function SolveBreakdown({
  memo,
  total,
  className = "",
}: {
  memo: number;
  total: number;
  className?: string;
}) {
  return (
    <dl className={`grid grid-cols-2 gap-x-6 gap-y-1 ${className}`}>
      {[
        ["Memorisation", memo],
        ["Execution", Math.max(0, total - memo)],
      ].map(([label, value]) => (
        <div key={label}>
          <dt className="text-[12px] text-ink-3">{label}</dt>
          <dd className="mt-1 font-mono text-[14px] text-ink-2 tnum">
            {formatTime(Number(value))}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** One result hierarchy for saved solves and every reconstruction step. */
export function SolveSummary({
  date,
  time,
  memoTime,
  penalty,
  onPenalty,
}: {
  date: string;
  time: number;
  memoTime?: number;
  penalty: Penalty;
  onPenalty: (penalty: Penalty) => void;
}) {
  return (
    <section aria-label="Solve summary" className="min-w-0">
      <time dateTime={date} className="block text-[12px] text-ink-3">
        {formatSolveDate(date)}
      </time>
      <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-timer text-[clamp(40px,6.5vh,60px)] font-extralight leading-none tracking-[-0.05em] text-ink tnum">
          {formatTime(time + (penalty === "+2" ? 2000 : 0))}
        </span>
        {penalty !== "ok" && (
          <span
            className={`text-[14px] ${penalty === "dnf" ? "text-[var(--danger)]" : "text-ink-2"}`}
          >
            {penalty === "dnf" ? "DNF" : "+2"}
          </span>
        )}
      </div>
      {memoTime !== undefined && (
        <SolveBreakdown memo={memoTime} total={time} className="mt-5" />
      )}
      <ResultControl className="mt-5" value={penalty} onChange={onPenalty} />
    </section>
  );
}
