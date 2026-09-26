import React from 'react';
import { modeInfo } from '../../data/trainingModes';
import { HoldPhase } from '../../hooks/useHoldStart';
import { TrainingSession } from '../../hooks/useTrainingSession';

const TONE: Record<HoldPhase, string> = {
  idle: 'text-ink',
  armed: 'text-ink-3',
  ready: 'text-accent'
};

/** The Timer's idle readout plus one sentence about the drill. Nothing about the next challenge shows until release. */
export function TrainingIdle({ t, onHelp }: {t: TrainingSession;onHelp: () => void;}) {
  const info = modeInfo(t.mode);
  const hold = t.hold.phase;
  return (
    <div className="md:pl-14">
      <div
        role="timer"
        aria-label={hold === 'ready' ? 'Ready, release to start' : 'Hold Space to start'}
        className={`tnum -ml-[0.06em] whitespace-nowrap font-timer text-[clamp(64px,min(12.5vw,18vh),176px)] font-extralight leading-[0.9] tracking-[-0.06em] transition-colors duration-150 ease-out ${TONE[hold]}`}>
        
        0.00
      </div>
      <p className="mt-[clamp(14px,3vh,28px)] max-w-[560px] text-[14px] leading-relaxed text-ink-3">
        {info.line}{' '}
        <button
          type="button"
          onClick={onHelp}
          onPointerDown={(e) => e.stopPropagation()}
          className="whitespace-nowrap text-ink-2 underline decoration-line-strong underline-offset-4 transition-colors duration-150 ease-out hover:text-ink">
          
          How it works
        </button>
      </p>
    </div>);

}