import React, { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { CaseSensitiveIcon, ChevronDownIcon, RefreshCwIcon } from 'lucide-react';
import { useAppData } from '../../../contexts/AppDataContext';
import { clamp, useElementSize } from '../../../hooks/useElementSize';
import { useHistoryCleanup } from '../../../hooks/useHistoryCleanup';
import { useTimerSession } from '../../../hooks/useTimerSession';
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
import { SessionManager } from '../../timer/SessionManager';
import { WorkspaceHistory } from './WorkspaceHistory';
import { WorkspaceReconstruction } from './WorkspaceReconstruction';
import { WorkspaceSolveDetails } from './WorkspaceSolveDetails';
import { useScreenInit } from '../../../useScreenInit.js';

/**
 * Workspace Timer.
 * An asymmetric instrument panel: the working surface at left (scramble, time, last memo),
 * a reference column at right (cube, session readout, times). Hairlines, no cards.
 * Sizes follow the viewport (clamp on vw/vh) so zoom and short windows keep everything reachable.
 */
export function WorkspaceTimer({ multiphase, stage }: ConceptProps) {
  const init = useScreenInit() as {sessions?: 'open' | 'confirm';letters?: boolean;};
  const s = useTimerSession({ multiphase, stage, initialSessionsOpen: !!init.sessions });
  const { sessions, activeSessionId } = useAppData();
  const sessionName = sessions.find((x) => x.id === activeSessionId)?.name ?? 'Session';
  const [letters, setLetters] = useState(!!init.letters);
  const [cubeRef, cubeBox] = useElementSize<HTMLDivElement>({ width: 392, height: 330 });
  const cubeSize = clamp(Math.min(cubeBox.width - 56, cubeBox.height - 36), 120, 272);
  const { phase } = s.timer;
  const recede = s.running ? 'opacity-[0.1]' : phase === 'ready' ? 'opacity-40' : '';
  const latest = s.latest;
  const cleanup = useHistoryCleanup({
    count: s.solves.length,
    noun: 'solve',
    scope: sessionName,
    latestLabel: latest ? `#${latest.index} · ${latest.penalty === 'dnf' ? 'DNF' : formatTime(latest.time)}` : undefined,
    removeLatest: s.deleteLatest,
    clearAll: s.clearSolves,
    keysEnabled: !s.running && !s.overlayOpen && phase !== 'armed' && phase !== 'ready'
  });

  return (
    <div className="theme-workspace flex h-[100dvh] w-full flex-col overflow-hidden bg-bg font-sans text-ink">
      <AppBar
        className={recede}
        onShortcuts={s.openShortcuts}
        right={
        <button
          type="button"
          onClick={s.openSessions}
          aria-haspopup="dialog"
          className="mr-1 flex h-7 max-w-[11rem] items-center gap-1.5 rounded-[4px] px-2.5 text-[12.5px] text-ink-2 transition-colors duration-150 ease-out hover:bg-hover hover:text-ink md:mr-2 md:max-w-[16rem]">
          
            <span className="truncate">
              <span className="hidden sm:inline">3BLD · </span>
              {sessionName}
            </span>
            <ChevronDownIcon size={13} strokeWidth={1.75} className="shrink-0" />
          </button>
        } />
      

      <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)_minmax(0,32dvh)] md:grid-cols-[minmax(0,1fr)_clamp(280px,28vw,392px)] md:grid-rows-1">
        <main className="flex min-h-0 min-w-0 flex-col">
          <section
            aria-label="Scramble"
            className={`flex shrink-0 items-start gap-4 border-b border-line px-5 py-[clamp(14px,3vh,28px)] transition-opacity duration-300 ease-out md:gap-6 md:px-10 ${
            s.running ? 'opacity-25' : ''}`
            }>
            
            <span className="hidden w-8 shrink-0 pt-[5px] font-mono text-[11px] text-ink-3 tnum md:block">#{s.nextIndex}</span>
            <ScrambleText scramble={s.scramble} className="min-w-0 flex-1 text-[clamp(15px,1.45vw,20px)] leading-[1.75] text-ink" />
            <button
              type="button"
              onClick={s.newScramble}
              aria-label="New scramble"
              title="New scramble"
              className="mt-0.5 inline-flex h-8 shrink-0 items-center gap-2 rounded-[4px] px-2 text-ink-3 transition-colors duration-150 ease-out hover:bg-hover hover:text-ink-2">
              
              <RefreshCwIcon size={14} strokeWidth={1.75} />
              <span className="hidden md:inline">
                <Kbd>N</Kbd>
              </span>
            </button>
          </section>

          <div
            className="flex min-h-0 flex-1 cursor-default touch-none select-none flex-col justify-center overflow-hidden px-5 md:px-10"
            {...s.timer.pointerHandlers}>
            
            <div className="md:pl-14">
              <TimerReadout
                phase={phase}
                value={s.timer.display}
                penalty={s.lastPenalty}
                className="-ml-[0.06em] font-timer text-[clamp(56px,min(12.5vw,19vh),176px)] font-extralight leading-[0.9] tracking-[-0.06em]" />
              
              <WorkspacePhase phase={phase} split={s.timer.split} elapsed={s.timer.elapsed} multiphase={multiphase} />
            </div>
          </div>

          {latest &&
          <section
            aria-label="Last solve memo"
            className={`hidden shrink-0 grid-cols-[auto_minmax(0,1fr)_minmax(0,1.2fr)] items-start gap-x-[clamp(16px,2.5vw,40px)] border-t border-line px-10 py-[clamp(12px,2.5vh,24px)] transition-opacity duration-300 ease-out md:grid ${recede} short:hidden`}>
            
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

        <aside
          className={`flex min-h-0 flex-col border-t border-line bg-surface transition-opacity duration-300 ease-out md:border-l md:border-t-0 ${recede}`}>
          
          <div
            ref={cubeRef}
            className="relative hidden h-[clamp(170px,36vh,330px)] shrink-0 items-center justify-center border-b border-line md:flex">
            
            <Cube3D state={s.cubeState} size={cubeSize} showLetters={letters} />
            <IconButton
              size="sm"
              label="Sticker letters"
              pressed={letters}
              onClick={() => setLetters((v) => !v)}
              className="absolute bottom-3 right-3">
              
              <CaseSensitiveIcon />
            </IconButton>
          </div>
          <WorkspaceHistory solves={s.solves} stats={s.stats} onSelect={s.selectSolve} onDelete={s.deleteSolve} onClear={cleanup.askClear} />
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
      {cleanup.dialog}
      <SessionManager
        open={s.sessionsOpen}
        onClose={s.closeSessions}
        initialConfirm={init.sessions === 'confirm' ? 'practice' : null} />
      
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
  if (!multiphase || !live && !done) return <div className="mt-[clamp(12px,3vh,28px)] h-7" />;
  const segs: {key: 'memo' | 'exec';value: number | null;}[] = [
  { key: 'memo', value: split },
  { key: 'exec', value: done && split !== null ? elapsed - split : null }];

  return (
    <div className="mt-[clamp(12px,3vh,28px)] flex h-7 items-stretch gap-1.5 font-mono text-[11.5px]">
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