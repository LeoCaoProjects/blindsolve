import React from 'react';
import { TrainingSession } from '../../hooks/useTrainingSession';

interface Action {
  label: string;
  onClick: () => void;
  hint: string;
}

/**
 * The one place every drill's primary action lives. Fixed height, lifted off the floor,
 * outside the scrolling stage — so Ready / Submit / Stop can never be pushed off-screen.
 */
export function TrainingDock({ t }: {t: TrainingSession;}) {
  let primary: Action | null = null;
  let secondary: Action | null = null;
  if (t.phase === 'active' && t.mode === 'recall') primary = { label: 'Ready', onClick: t.toRecall, hint: 'Space' };else
  if (t.phase === 'active' && t.mode === 'exec') primary = { label: 'Stop', onClick: t.submit, hint: 'Space' };else
  if (t.phase === 'memo' && t.mode === 'guided') primary = { label: 'Start execution', onClick: t.startExecution, hint: 'Space' };else
  if (t.phase === 'execution' && t.mode === 'guided') primary = { label: 'Stop', onClick: t.stopGuided, hint: 'Space' };else
  if (t.phase === 'active') primary = { label: 'Submit', onClick: t.submit, hint: '↵' };else
  if (t.phase === 'recall') {
    primary = { label: 'Submit', onClick: t.submit, hint: '↵' };
    secondary = { label: 'Show answer', onClick: t.submit, hint: 'esc' };
  }

  return (
    <section aria-label="Actions" className="dock-inset shrink-0 px-5 pt-3 md:px-10 md:pl-24">
      <div className="flex min-h-[44px] items-center gap-2">
        {primary &&
        <button
          type="button"
          onClick={primary.onClick}
          className="inline-flex h-11 items-center gap-3 whitespace-nowrap rounded-[4px] bg-ink px-4 text-[13.5px] font-medium text-bg transition-opacity duration-150 ease-out hover:opacity-90">
          
            {primary.label}
            <span className="font-mono text-[11px] opacity-50">{primary.hint}</span>
          </button>
        }
        {secondary &&
        <button
          type="button"
          onClick={secondary.onClick}
          className="inline-flex h-11 items-center gap-2 whitespace-nowrap rounded-[4px] px-3 text-[13px] text-ink-3 transition-colors duration-150 ease-out hover:bg-hover hover:text-ink-2">
          
            {secondary.label} <span className="font-mono text-[11px]">{secondary.hint}</span>
          </button>
        }
        {t.phase === 'idle' && <span className="text-[12.5px] text-ink-3 md:hidden">Press and hold to start</span>}
      </div>
    </section>);

}
