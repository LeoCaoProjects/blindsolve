import React from 'react';
import { CheckIcon, XIcon } from 'lucide-react';

interface ReviewSummaryProps {
  status?: 'correct' | 'incorrect' | null;
  statusLabel?: string;
  time?: string;
  stats: [string, string][];
  children?: React.ReactNode;
}

/** Status and time first; the few numbers that matter on one quiet line beneath. */
export function ReviewSummary({ status, statusLabel, time, stats, children }: ReviewSummaryProps) {
  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
        {time &&
        <span className="tnum font-timer text-[clamp(36px,6vh,56px)] font-extralight leading-none tracking-[-0.04em] text-ink">{time}</span>
        }
        {status &&
        <p className={`flex items-center gap-2.5 ${time ? 'text-[15px]' : 'text-[22px]'} text-ink`}>
            {status === 'correct' ?
          <CheckIcon size={time ? 15 : 20} strokeWidth={1.75} className="self-center text-ink-2" aria-hidden /> :

          <XIcon size={time ? 15 : 20} strokeWidth={1.75} className="self-center text-accent" aria-hidden />
          }
            {statusLabel ?? (status === 'correct' ? 'Correct' : 'Incorrect')}
          </p>
        }
      </div>
      <dl className="mt-3 flex flex-wrap gap-x-7 gap-y-2">
        {stats.map(([k, v]) =>
        <div key={k} className="flex items-baseline gap-2">
            <dt className="text-[11.5px] text-ink-3">{k}</dt>
            <dd className="font-mono text-[13.5px] text-ink-2 tnum">{v}</dd>
          </div>
        )}
      </dl>
      {children}
    </div>);

}