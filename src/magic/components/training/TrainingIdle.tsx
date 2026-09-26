import React from 'react';
import { HoldPhase } from '../../hooks/useHoldStart';

const TONE: Record<HoldPhase, string> = {
  idle: 'text-ink',
  armed: 'text-ink-3',
  ready: 'text-accent'
};

/** The Timer's idle readout. Nothing about the next challenge is shown until release. */
export function TrainingIdle({ hold }: {hold: HoldPhase;}) {
  return (
    <div className="md:pl-14">
      <div
        role="timer"
        aria-label={hold === 'ready' ? 'Ready — release to start' : 'Hold Space to start'}
        className={`tnum -ml-[0.06em] whitespace-nowrap font-timer text-[112px] font-extralight leading-[0.9] tracking-[-0.06em] transition-colors duration-150 ease-out md:text-[176px] ${TONE[hold]}`}>
        
        0.00
      </div>
      <div className="mt-7 h-7" />
    </div>);

}