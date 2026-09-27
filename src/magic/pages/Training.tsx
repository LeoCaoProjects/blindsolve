import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { RefreshCwIcon } from 'lucide-react';
import { Kbd } from '../components/common/Kbd';
import { ShortcutSheet } from '../components/common/ShortcutSheet';
import { AppBar } from '../components/layout/AppBar';
import { ScrambleText } from '../components/solve/ScrambleText';
import { ExecutionWorkspace } from '../components/training/ExecutionWorkspace';
import { Fade } from '../components/training/Fade';
import { FullMemoWorkspace } from '../components/training/FullMemoWorkspace';
import { MemoRecallWorkspace } from '../components/training/MemoRecallWorkspace';
import { ExecReview } from '../components/training/review/ExecReview';
import { FullMemoReview } from '../components/training/review/FullMemoReview';
import { RecallReview } from '../components/training/review/RecallReview';
import { TraceReview } from '../components/training/review/TraceReview';
import { TraceSprintWorkspace } from '../components/training/TraceSprintWorkspace';
import { TrainingAside } from '../components/training/TrainingAside';
import { TrainingDock } from '../components/training/TrainingDock';
import { TrainingHeader } from '../components/training/TrainingHeader';
import { TrainingHelp } from '../components/training/TrainingHelp';
import { TrainingIdle } from '../components/training/TrainingIdle';
import { modeInfo } from '../data/trainingModes';
import { recordTraining } from '../utils/feedbackContext';
import { useElementSize } from '../hooks/useElementSize';
import { useHistoryCleanup } from '../hooks/useHistoryCleanup';
import { useShortcutSheet } from '../hooks/useShortcutSheet';
import { TrainInit, useTrainingSession } from '../hooks/useTrainingSession';
import { isTypingTarget } from '../utils/keyboard';
import { formatTime } from '../utils/time';
import { useScreenInit } from '../useScreenInit.js';

/**
 * One practice instrument, four drills.
 * Layout contract: header (drill · settings) / stage (flexible, scrolls inside) / dock (fixed, inset).
 * During Trace Sprint, Full Memo and Execution Sprint attempts the side column steps away so the
 * cube and answer get the room. Reviews open in a right-hand sheet over the frozen stage.
 */
export function Training() {
  const init = useScreenInit() as TrainInit;
  const sheet = useShortcutSheet();
  const t = useTrainingSession(init);
  // Drill and pieces only, for bug reports. Never answers or mnemonics.
  useEffect(() => {
    recordTraining(modeInfo(t.mode).label, t.filter === 'both' ? 'Both' : t.filter === 'edges' ? 'Edges' : 'Corners');
  }, [t.mode, t.filter]);
  const [stageRef, stage] = useElementSize<HTMLDivElement>({ width: 900, height: 560 });
  const [helpOpen, setHelpOpen] = useState(!!init.help);

  const busy = t.running;
  const holding = t.hold.phase !== 'idle';
  const execSetup = t.mode === 'exec' && t.phase === 'idle';
  // The side column stays away through review too, so submitting never reflows the stage.
  const showAside = t.mode === 'recall' || t.phase === 'idle';
  const latest = t.history[0];
  // Freeze the measured stage once an attempt ends: the cube keeps its size under the review sheet.
  const stableStage = useRef(stage);
  if (t.phase !== 'review') stableStage.current = stage;

  const cleanup = useHistoryCleanup({
    count: t.history.length,
    noun: 'attempt',
    scope: modeInfo(t.mode).label,
    latestLabel: latest ? t.mode === 'exec' && !latest.correct ? 'DNF' : formatTime(latest.ms) : undefined,
    removeLatest: t.removeLatestAttempt,
    clearAll: t.clearAttempts,
    keysEnabled: t.phase === 'idle' && !holding && !helpOpen
  });

  // N swaps the Execution Sprint scramble before starting, as on the Timer.
  useEffect(() => {
    if (!execSetup) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'n' && e.key !== 'N' || isTypingTarget(e.target) || e.metaKey || e.ctrlKey || e.repeat) return;
      if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return;
      t.newScramble();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [execSetup, t]);

  const stopHandlers =
  t.mode === 'exec' && t.phase === 'active' ?
  {
    onPointerDown: (e: React.PointerEvent) => {
      if ((e.target as HTMLElement).closest('button, a, input')) return;
      t.submit();
    }
  } :
  {};

  return (
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-bg font-sans text-ink">
      <AppBar className={busy ? 'opacity-[0.25]' : holding ? 'opacity-40' : ''} onShortcuts={sheet.openSheet} />

      <div className={`grid min-h-0 flex-1 grid-cols-1 ${showAside ? 'xl:grid-cols-[minmax(0,1fr)_clamp(280px,24vw,360px)]' : ''}`}>
        <main className="flex min-h-0 min-w-0 flex-col">
          <TrainingHeader t={t} />

          {execSetup &&
          <section
            aria-label="Scramble"
            className={`flex shrink-0 items-start gap-4 border-b border-line px-5 py-[clamp(14px,3vh,28px)] transition-opacity duration-300 ease-out md:gap-6 md:px-10 ${
            holding ? 'opacity-40' : ''}`
            }>
            
              <span className="hidden w-8 shrink-0 pt-[5px] font-mono text-[11px] text-ink-3 tnum md:block">#{t.history.length + 1}</span>
              {t.scrambleReady ?
            <ScrambleText scramble={t.scramble} className="min-w-0 flex-1 text-[clamp(15px,1.45vw,20px)] leading-[1.75] text-ink" /> :

            <p role="status" className="min-w-0 flex-1 font-mono text-[clamp(15px,1.45vw,20px)] leading-[1.75] text-ink-3">
                  Preparing scramble…
                </p>
            }
              <button
              type="button"
              onClick={t.newScramble}
              aria-label="New scramble"
              title="New scramble"
              className="mt-0.5 inline-flex h-8 shrink-0 items-center gap-2 rounded-[4px] px-2 text-ink-3 transition-colors duration-150 ease-out hover:bg-hover hover:text-ink-2">
              
                <RefreshCwIcon size={14} strokeWidth={1.75} />
                <span className="hidden md:inline">
                  <Kbd>N</Kbd>
                </span>
              </button>
            </section>
          }

          <div
            className={`relative flex min-h-0 flex-1 flex-col px-5 py-[clamp(12px,3vh,28px)] md:px-10 ${
            t.phase === 'idle' ? 'cursor-default touch-none select-none' : ''}`
            }
            {...t.phase === 'idle' ? t.hold.pointerHandlers : stopHandlers}>
            
            <div ref={stageRef} className="flex min-h-0 flex-1 flex-col justify-center">
              <AnimatePresence mode="wait" initial={false}>
                {t.phase === 'idle' ?
                <Fade key={`idle-${t.mode}`} className="scroll-quiet max-h-full overflow-y-auto">
                    <TrainingIdle t={t} onHelp={() => setHelpOpen(true)} />
                  </Fade> :

                <Fade key={`run-${t.mode}`} className="h-full min-h-0">
                    {t.mode === 'recall' && <MemoRecallWorkspace t={t} stage={stableStage.current} />}
                    {t.mode === 'exec' && <ExecutionWorkspace t={t} />}
                    {t.mode === 'trace' && <TraceSprintWorkspace t={t} stage={stableStage.current} />}
                    {t.mode === 'full' && <FullMemoWorkspace t={t} stage={stableStage.current} />}
                  </Fade>
                }
              </AnimatePresence>
            </div>
          </div>

          <TrainingDock t={t} />
        </main>

        {showAside &&
        <TrainingAside
          t={t}
          onClear={cleanup.askClear}
          recede={busy ? 'opacity-[0.15]' : holding ? 'opacity-60' : ''} />

        }
      </div>

      <AnimatePresence>
        {t.phase === 'review' && t.mode === 'recall' && <RecallReview key="recall" t={t} />}
        {t.phase === 'review' && t.mode === 'trace' && <TraceReview key="trace" t={t} />}
        {t.phase === 'review' && t.mode === 'full' && <FullMemoReview key="full" t={t} />}
        {t.phase === 'review' && t.mode === 'exec' && <ExecReview key="exec" t={t} />}
      </AnimatePresence>
      <TrainingHelp open={helpOpen} onClose={() => setHelpOpen(false)} mode={t.mode} />
      <ShortcutSheet open={sheet.open} onClose={sheet.closeSheet} page="training" />
      {cleanup.dialog}
    </div>);

}