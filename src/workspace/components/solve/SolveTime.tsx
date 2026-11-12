import React from 'react';
import { Penalty } from '../../types/solve';
import { formatTime } from '../../utils/time';

interface SolveTimeProps {
  time: number;
  penalty: Penalty;
  className?: string;
  /** Show the raw time beside DNF */
  showRaw?: boolean;
}

export function SolveTime({ time, penalty, className = '', showRaw = true }: SolveTimeProps) {
  if (penalty === 'dnf') {
    return (
      <span className={`tnum whitespace-nowrap ${className}`}>
        DNF
        {showRaw &&
        <span className="ml-[0.5em] text-[0.62em] text-ink-3 line-through" aria-label={`raw ${formatTime(time)}`}>
            {formatTime(time)}
          </span>
        }
      </span>);

  }
  if (penalty === '+2') {
    return (
      <span className={`tnum whitespace-nowrap ${className}`}>
        {formatTime(time + 2000)}
        <span className="ml-[0.35em] text-[0.62em] text-ink-3">+2</span>
      </span>);

  }
  return <span className={`tnum whitespace-nowrap ${className}`}>{formatTime(time)}</span>;
}