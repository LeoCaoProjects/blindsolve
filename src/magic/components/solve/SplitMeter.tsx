import React from 'react';
import { formatTime } from '../../utils/time';

interface SplitMeterProps {
  memo: number;
  total: number;
  className?: string;
  showLabels?: boolean;
  bar?: boolean;
}

/** Memo / execution proportion. Grayscale hierarchy: memo reads brighter than execution. */
export function SplitMeter({ memo, total, className = '', showLabels = false, bar = true }: SplitMeterProps) {
  const exec = Math.max(0, total - memo);
  const pct = Math.min(100, Math.max(0, memo / total * 100));
  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-6 font-mono text-[13px] tnum">
        <span className="text-ink">
          {showLabels ? <span className="mr-2 font-sans text-[11.5px] text-ink-3">memo</span> : <span className="sr-only">memo </span>}
          {formatTime(memo)}
        </span>
        <span className="text-ink-2">
          {showLabels ? <span className="mr-2 font-sans text-[11.5px] text-ink-3">exec</span> : <span className="sr-only">execution </span>}
          {formatTime(exec)}
        </span>
      </div>
      {bar &&
      <div aria-hidden className="mt-2 flex h-[2px] w-full gap-[3px]">
          <span className="bg-ink-2" style={{ width: `${pct}%` }} />
          <span className="flex-1 bg-line-strong" />
        </div>
      }
    </div>);

}