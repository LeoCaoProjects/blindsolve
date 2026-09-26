import React, { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { CaseSensitiveIcon, ChevronDownIcon, RefreshCwIcon } from 'lucide-react';
import { useTimerSession } from '../../../hooks/useTimerSession';
import { useAppData } from '../../../contexts/AppDataContext';
import { TimerPhase } from '../../../hooks/useTimer';
import { ConceptProps } from '../../../types/solve';
import { formatTime } from '../../../utils/time';
import { IconButton } from '../../common/IconButton';
import { Kbd } from '../../common/Kbd';
import { ShortcutSheet } from '../../common/ShortcutSheet';
import { Cube3D } from '../../cube/Cube3D';
import { MemoTrace } from '../../solve/MemoTrace';
import { ScrambleText } from '../../solve/ScrambleText';
import { SolveTime } from '../../solve/SolveTime';
import { TimerReadout } from '../../solve/TimerReadout';
import { AppBar } from '../../layout/AppBar';
import { WorkspaceHistory } from './WorkspaceHistory';
import { WorkspaceReconstruction } from './WorkspaceReconstruction';
import { WorkspaceSolveDetails } from './WorkspaceSolveDetails';

/**
 * Concept C — Workspace.
 * An asymmetric instrument panel: the working surface at left (scramble, time, last memo),
 * a reference column at right (cube, session readout, times). Hairlines, no cards.
 */
export function WorkspaceTimer({ multiphase, stage }: ConceptProps) {
  const s = useTimerSession({ multiphase, stage });
  const { prefs } = useAppData();
  const [letters, setLetters] = useState(false);
  const { phase } = s.timer;
  const recede = s.running ? 'opacity-[0.1]' : phase === 'ready' ? 'opacity-40' : '';
  const latest = s.latest;

  return (
    <div className="theme-workspace flex min-h-[100dvh] w-full flex-col overflow-x-hidden bg-bg font-sans text-ink">
      <AppBar
        className={recede}
        onShortcuts={s.openShortcuts}
        right={
        <button
          type="button"
          className="mr-2 hidden h-7 items-center gap-1.5 rounded-[4px] px-2.5 text-[12.5px] text-ink-2 transition-colors duration-150 ease-out hover:bg-hover hover:text-ink md:flex">
          
            3BLD · Today
            <ChevronDownIcon size={13} strokeWidth={1.75} />
          </button>
        } />
      

      <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[minmax(0,1fr)_392px]">
        <main className="flex min-w-0 flex-col">
          <section
            aria-label="Scramble"
            className={`flex items-start gap-3 border-b border-line px-5 py-5 sm:gap-6 sm:px-10 sm:py-7 transition-opacity duration-300 ease-out ${
            s.running ? 'opacity-25' : ''}`
            }>
            
            <span className="w-8 shrink-0 pt-[5px] font-mono text-[11px] text-ink-3 tnum">#{s.nextIndex}</span>
            <ScrambleText scramble={s.scramble} className="min-w-0 flex-1 text-[clamp(0.9rem,2vw,1.25rem)] leading-[1.75] text-ink" />
            <button
              type="button"
              onClick={s.newScramble}
              aria-label="New scramble"
              title="New scramble"
              className="mt-0.5 inline-flex h-8 shrink-0 items-center gap-2 rounded-[4px] px-2 text-ink-3 transition-colors duration-150 ease-out hover:bg-hover hover:text-ink-2">
              
              <RefreshCwIcon size={14} strokeWidth={1.75} />
              <Kbd>N</Kbd>
            </button>
          </section>

          <div className="flex min-h-[min(28rem,55dvh)] flex-1 cursor-default touch-none select-none flex-col justify-center px-5 sm:px-10" {...s.timer.pointerHandlers}>
            <div className="pl-0 sm:pl-14">
              <TimerReadout
                phase={phase}
                value={s.timer.display}
                penalty={s.lastPenalty}
                className="-ml-[0.06em] max-w-full font-timer text-[clamp(4.5rem,13vw,11rem)] font-extralight leading-[0.9] tracking-[-0.06em]" />
              
              <WorkspacePhase phase={phase} split={s.timer.split} elapsed={s.timer.elapsed} multiphase={multiphase} />
            </div>
          </div>

          {latest &&
          <section
            aria-label="Last solve memo"
            className={`grid shrink-0 grid-cols-1 items-start gap-5 border-t border-line px-5 py-5 sm:grid-cols-[auto_minmax(0,1fr)_minmax(0,1.2fr)] sm:gap-x-10 sm:px-10 sm:py-6 transition-opacity duration-300 ease-out ${recede}`}>
            
              <button type="button" onClick={() => s.selectSolve(latest.id)} className="group flex items-baseline gap-4 text-left">
                <span className="w-8 font-mono text-[11px] text-ink-3 tnum">#{latest.index}</span>
                <SolveTime
                time={latest.time}
                penalty={latest.penalty}
                showRaw={false}
                className="font-mono text-[15px] text-ink-2 transition-colors duration-150 group-hover:text-ink" />
              
              </button>
              <MemoTrace
              size="sm"
              pairs={latest.memo.corners.map((p) => p.pair)}
              words={latest.memo.corners.map((p) => p.word)}
              breakAt={latest.memo.cornerBreakAt ?? null} />
            
              <MemoTrace
              size="sm"
              pairs={latest.memo.edges.map((p) => p.pair)}
              words={latest.memo.edges.map((p) => p.word)}
              breakAt={latest.memo.edgeBreakAt ?? null} />
            
            </section>
          }
        </main>

        <aside className={`flex min-h-0 flex-col border-t border-line bg-surface transition-opacity duration-300 ease-out xl:border-l xl:border-t-0 ${recede}`}>
          <div className="relative flex h-[min(330px,64vw)] min-h-[210px] shrink-0 items-center justify-center border-b border-line xl:h-[330px]">
            <Cube3D state={s.cubeState} size={272} showLetters={letters} view={prefs.defaultView} className="scale-[clamp(.72,1vw,.99)]" />
            <IconButton
              size="sm"
              label="Sticker letters"
              pressed={letters}
              onClick={() => setLetters((v) => !v)}
              className="absolute bottom-3 right-3">
              
              <CaseSensitiveIcon />
            </IconButton>
          </div>
          <WorkspaceHistory solves={s.solves} stats={s.stats} onSelect={s.selectSolve} />
        </aside>
      </div>

      <AnimatePresence>
        {s.reconOpen && s.draft && <WorkspaceReconstruction key="recon" draft={s.draft} db={s.db} onSave={s.saveSolve} />}
      </AnimatePresence>
      <AnimatePresence>
        {s.selected &&
        <WorkspaceSolveDetails
          key="details"
          solve={s.selected}
          db={s.db}
          onClose={s.closeDetails}
          onPenalty={s.setPenalty}
          onDelete={s.deleteSolve} />

        }
      </AnimatePresence>
      <ShortcutSheet open={s.shortcutsOpen} onClose={s.closeShortcuts} />
    </div>);

}

/** Segmented status, like an instrument's mode lamps. Blank when idle. */
function WorkspacePhase({
  phase,
  split,
  elapsed,
  multiphase





}: {phase: TimerPhase;split: number | null;elapsed: number;multiphase: boolean;}) {
  const live = phase === 'memo' || phase === 'exec' || phase === 'running';
  const done = phase === 'stopped' && split !== null;
  if (!multiphase || !live && !done) return <div className="mt-7 h-7" />;
  const segs: {key: 'memo' | 'exec';value: number | null;}[] = [
  { key: 'memo', value: split },
  { key: 'exec', value: done && split !== null ? elapsed - split : null }];

  return (
    <div className="mt-7 flex h-7 items-stretch gap-1.5 font-mono text-[11.5px]">
      {segs.map((seg) => {
        const active = phase === seg.key;
        return (
          <span
            key={seg.key}
            className={`flex items-center gap-2 rounded-[3px] border px-2.5 transition-colors duration-150 ease-out ${
            active ? 'border-line-strong text-ink' : 'border-line text-ink-3'}`
            }>
            
            <span className={`h-[5px] w-[5px] rounded-full ${active ? 'bg-accent' : 'bg-line-strong'}`} />
            {seg.key}
            {seg.value !== null && <span className="tnum text-ink-2">{formatTime(seg.value)}</span>}
          </span>);

      })}
    </div>);

}
