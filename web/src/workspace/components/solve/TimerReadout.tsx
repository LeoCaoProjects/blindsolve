import React from 'react';
import { TimerPhase } from '../../hooks/useTimer';
import { Penalty } from '../../types/solve';
import { formatTime } from '../../utils/time';

interface TimerReadoutProps {
  phase: TimerPhase;
  value: number;
  penalty?: Penalty | null;
  className?: string;
  tones?: Partial<Record<TimerPhase, string>>;
  showLiveTimer?: boolean;
  ariaLabel?: string;
}

const DEFAULT_TONES: Record<TimerPhase, string> = {
  idle: 'text-ink',
  armed: 'text-ink-3',
  ready: 'text-accent',
  memo: 'text-ink',
  exec: 'text-ink',
  running: 'text-ink',
  stopped: 'text-ink'
};

export function TimerReadout({ phase, value, penalty, className = '', tones, showLiveTimer = true, ariaLabel }: TimerReadoutProps) {
  const tone = { ...DEFAULT_TONES, ...tones }[phase];
  let content: React.ReactNode = formatTime(value);
  if (!showLiveTimer && (phase === 'memo' || phase === 'exec' || phase === 'running')) content = 'Solve';
  if (phase === 'stopped' && penalty === 'dnf') content = 'DNF';
  if (phase === 'stopped' && penalty === '+2')
  content =
  <>
        {formatTime(value + 2000)}
        <span className="ml-[0.12em] align-top text-[0.22em] tracking-normal text-ink-3">+2</span>
      </>;

  return (
    <div role="timer" aria-label={ariaLabel} aria-live="off" className={`tnum whitespace-nowrap timing-tone ${tone} ${className}`}>
      {content}
    </div>);

}
