import React from 'react';
import { Segmented } from '../components/common/Segmented';
import { ShortcutSheet } from '../components/common/ShortcutSheet';
import { AppBar } from '../components/layout/AppBar';
import { FullMemoWorkspace } from '../components/training/FullMemoWorkspace';
import { MemoRecallWorkspace } from '../components/training/MemoRecallWorkspace';
import { TraceSprintWorkspace } from '../components/training/TraceSprintWorkspace';
import { TrainingAside } from '../components/training/TrainingAside';
import { useElementWidth } from '../hooks/useElementWidth';
import { useShortcutSheet } from '../hooks/useShortcutSheet';
import { TrainInit, TrainMode, TrainingSession, useTrainingSession } from '../hooks/useTrainingSession';
import { TrainFilter } from '../utils/bld';
import { formatTime } from '../utils/time';
import { useScreenInit } from '../useScreenInit';

const MODES: {value: TrainMode;label: string;}[] = [
{ value: 'recall', label: 'Memo Recall' },
{ value: 'trace', label: 'Trace Sprint' },
{ value: 'full', label: 'Full Memo' }];


const FILTERS: {value: TrainFilter;label: string;}[] = [
{ value: 'corners', label: 'Corners' },
{ value: 'edges', label: 'Edges' },
{ value: 'both', label: 'Both' }];


/** One practice instrument, three exercises. Every attempt starts with hold-and-release Space. */
export function Training() {
  const init = useScreenInit() as TrainInit;
  const sheet = useShortcutSheet();
  const t = useTrainingSession(init);
  const [stageRef, stageWidth] = useElementWidth<HTMLDivElement>(900);
  const cubeSize = Math.max(180, Math.min(300, (stageWidth - 80) / 2));
  const busy = t.running;
  const holding = t.hold.phase !== 'idle';

  return (
    <div className="flex min-h-[100dvh] w-full flex-col overflow-x-hidden bg-bg font-sans text-ink">
      <AppBar className={busy ? 'opacity-[0.25]' : holding ? 'opacity-40' : ''} onShortcuts={sheet.openSheet} />

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_392px]">
        <main className="flex min-w-0 flex-col">
          <section className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-line px-5 py-4 md:px-10">
            <div className={`flex flex-wrap items-center gap-3 transition-opacity duration-300 ease-out ${busy ? 'opacity-40' : ''}`}>
              <Segmented label="Exercise" value={t.mode} onChange={t.setMode} options={MODES.map((m) => ({ ...m, disabled: busy }))} />
              <Segmented
                label="Pieces"
                size="sm"
                value={t.filter}
                onChange={t.setFilter}
                options={FILTERS.map((f) => ({ ...f, disabled: busy }))} />
              
            </div>
            <Clock t={t} />
          </section>

          <div
            ref={stageRef}
            className={`relative flex min-h-0 flex-1 cursor-default flex-col justify-center px-5 py-6 md:px-10 ${
            t.phase === 'idle' ? 'touch-none select-none' : ''}`
            }
            {...t.hold.pointerHandlers}>
            
            {t.mode === 'recall' &&
            <div className="scroll-quiet min-h-0 overflow-y-auto">
                <MemoRecallWorkspace t={t} />
              </div>
            }
            {t.mode === 'trace' && <TraceSprintWorkspace t={t} cubeSize={cubeSize} />}
            {t.mode === 'full' && <FullMemoWorkspace t={t} cubeSize={cubeSize} />}
          </div>

          <ActionBar t={t} />
        </main>

        <TrainingAside t={t} className={busy && t.mode !== 'recall' ? 'opacity-[0.15]' : busy ? '' : holding ? 'opacity-60' : ''} />
      </div>
      <ShortcutSheet open={sheet.open} onClose={sheet.closeSheet} page="training" />
    </div>);

}

function Clock({ t }: {t: TrainingSession;}) {
  if (t.phase === 'idle') return null;
  const cells: [string, number, boolean][] =
  t.mode === 'recall' ?
  [
  ['memo', t.elapsed.memo, t.phase === 'active'],
  ...(t.phase !== 'active' ? [['recall', t.elapsed.recall, t.phase === 'recall']] as [string, number, boolean][] : [])] :

  [[t.mode === 'trace' ? 'trace' : 'memo', t.elapsed.total, t.phase === 'active']];
  return (
    <p className="ml-auto flex gap-5 font-mono text-[12px] text-ink-3 tnum" role="timer">
      {cells.map(([label, ms, live]) =>
      <span key={label} className={live ? 'text-ink-2' : ''}>
          {label} <span className="ml-1">{formatTime(ms)}</span>
        </span>
      )}
    </p>);

}

function ActionBar({ t }: {t: TrainingSession;}) {
  let primary: {label: string;onClick: () => void;hint: string;} | null = null;
  let secondary: {label: string;onClick: () => void;hint?: string;} | null = null;
  if (t.phase === 'active' && t.mode === 'recall') primary = { label: 'Ready', onClick: t.toRecall, hint: 'Space' };else
  if (t.phase === 'active') primary = { label: 'Submit', onClick: t.submit, hint: '↵' };else
  if (t.phase === 'recall') {
    primary = { label: 'Submit', onClick: t.submit, hint: '↵' };
    secondary = { label: 'Show answer', onClick: t.submit, hint: 'esc' };
  } else if (t.phase === 'review') primary = { label: 'Next', onClick: t.next, hint: '↵' };

  return (
    <section className="flex h-[76px] shrink-0 items-center gap-2 border-t border-line px-5 md:px-10 md:pl-24">
      {primary &&
      <button
        type="button"
        onClick={primary.onClick}
        className="inline-flex h-11 items-center gap-3 rounded-[4px] bg-ink px-4 text-[13.5px] font-medium text-bg transition-opacity duration-150 ease-out hover:opacity-90">
        
          {primary.label}
          <span className="font-mono text-[11px] opacity-50">{primary.hint}</span>
        </button>
      }
      {secondary &&
      <button
        type="button"
        onClick={secondary.onClick}
        className="inline-flex h-11 items-center gap-2 rounded-[4px] px-3 text-[13px] text-ink-3 transition-colors duration-150 ease-out hover:bg-hover hover:text-ink-2">
        
          {secondary.label} {secondary.hint && <span className="font-mono text-[11px]">{secondary.hint}</span>}
        </button>
      }
      {t.phase === 'idle' && <span className="text-[12.5px] text-ink-3 md:hidden">Press and hold to start</span>}
    </section>);

}
