import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckIcon, XIcon } from 'lucide-react';
import { TrainingSession } from '../../hooks/useTrainingSession';
import { SOLVED_STATE } from '../../utils/bld';
import { EASE_OUT } from '../../utils/keyboard';
import { formatTime } from '../../utils/time';
import { Cube3D } from '../cube/Cube3D';
import { SessionReadout } from '../practice/SessionReadout';

/** Reference column, as on the Timer: cube (Memo Recall only), session readout, attempts. */
export function TrainingAside({ t, className = '' }: {t: TrainingSession;className?: string;}) {
  const h = t.history;
  const n = h.length;
  const mean = n ? h.reduce((s, a) => s + a.ms, 0) / n : 0;
  const correct = h.filter((a) => a.correct).length;
  const pairsTotal = h.reduce((s, a) => s + (a.pairs ?? 0), 0);

  const cells: [string, string][] =
  t.mode === 'recall' ?
  [
  ['attempts', String(n)],
  ['correct', `${correct}/${n}`],
  ['mean memo', n ? formatTime(mean) : '—']] :

  t.mode === 'trace' ?
  [
  ['attempts', String(n)],
  ['correct', `${correct}/${n}`],
  ['mean trace', n ? formatTime(mean) : '—']] :

  [
  ['attempts', String(n)],
  ['mean', n ? formatTime(mean) : '—'],
  ['per pair', pairsTotal ? formatTime(h.reduce((s, a) => s + a.ms, 0) / pairsTotal) : '—']];


  const showCube = t.mode === 'recall';
  const live = t.phase !== 'idle';

  return (
    <aside className={`hidden min-h-0 flex-col border-l border-line bg-surface transition-opacity duration-300 ease-out lg:flex ${className}`}>
      {showCube &&
      <div
        className={`flex h-[330px] shrink-0 items-center justify-center border-b border-line transition-opacity duration-200 ease-out ${
        !live ? 'opacity-25' : t.phase === 'recall' ? 'opacity-[0.1]' : ''}`
        }>
        
          <Cube3D
          state={live ? t.challenge.state : SOLVED_STATE}
          size={260}
          label={live ? 'The cube this memo was traced from' : 'No challenge yet'} />
        
        </div>
      }
      <SessionReadout cells={cells} />
      <ol aria-label="Attempts" className="scroll-quiet min-h-0 flex-1 overflow-y-auto py-2">
        <AnimatePresence initial={false}>
          {h.map((a, i) =>
          <motion.li
            key={a.id}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            transition={{ duration: 0.2, ease: EASE_OUT }}
            className="grid grid-cols-[30px_20px_1fr_auto] items-center px-5 py-[7px]">
            
              <span className={`font-mono text-[10.5px] tnum ${i === 0 ? 'text-accent' : 'text-ink-3'}`}>{n - i}</span>
              {t.mode === 'full' ?
            <span /> :
            a.correct ?
            <CheckIcon size={13} className="text-ink-3" aria-label="correct" /> :

            <XIcon size={13} className="text-accent" aria-label="incorrect" />
            }
              <span className={`font-mono text-[14.5px] tnum ${i === 0 ? 'text-ink' : 'text-ink-2'}`}>{formatTime(a.ms)}</span>
              <span className="font-mono text-[11px] text-ink-3 tnum">{t.mode === 'full' ? `${a.pairs ?? 0} pairs` : a.targets}</span>
            </motion.li>
          )}
        </AnimatePresence>
      </ol>
    </aside>);

}