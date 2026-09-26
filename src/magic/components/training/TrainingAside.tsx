import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckIcon, XIcon } from 'lucide-react';
import { clamp, useElementSize } from '../../hooks/useElementSize';
import { TrainingSession } from '../../hooks/useTrainingSession';
import { SOLVED_STATE } from '../../utils/bld';
import { stateFromScramble } from '../../utils/cube';
import { EASE_OUT } from '../../utils/keyboard';
import { formatTime } from '../../utils/time';
import { HistoryHeader, RowDelete } from '../common/HistoryHeader';
import { Cube3D } from '../cube/Cube3D';
import { SessionReadout } from '../practice/SessionReadout';

/**
 * Reference column on wide screens, as on the Timer: a cube where one helps (Memo Recall's
 * challenge, Execution Sprint's scramble to check against), the readout, and attempts.
 */
export function TrainingAside({ t, onClear, className = '' }: {t: TrainingSession;onClear: () => void;className?: string;}) {
  const [boxRef, box] = useElementSize<HTMLDivElement>({ width: 340, height: 300 });
  const cubeSize = clamp(Math.min(box.width - 64, box.height - 40), 140, 260);
  const h = t.history;
  const n = h.length;
  const mean = n ? h.reduce((s, a) => s + a.ms, 0) / n : 0;
  const correct = h.filter((a) => a.correct).length;
  const pairsTotal = h.reduce((s, a) => s + (a.pairs ?? 0), 0);

  const cells: [string, string][] =
  t.mode === 'full' ?
  [
  ['attempts', String(n)],
  ['correct', `${correct}/${n}`],
  ['per pair', pairsTotal ? formatTime(h.reduce((s, a) => s + a.ms, 0) / pairsTotal) : '—']] :

  [
  ['attempts', String(n)],
  [t.mode === 'exec' ? 'solved' : 'correct', `${correct}/${n}`],
  [t.mode === 'recall' ? 'mean memo' : t.mode === 'trace' ? 'mean trace' : 'mean exec', n ? formatTime(mean) : '—']];


  const live = t.phase !== 'idle';
  const cube =
  t.mode === 'recall' ?
  { state: live ? t.challenge.state : SOLVED_STATE, dim: !live ? 'opacity-25' : t.phase === 'recall' ? 'opacity-[0.08]' : '', label: live ? 'The cube this memo was traced from' : 'No challenge yet' } :
  t.mode === 'exec' && t.phase === 'idle' ?
  { state: stateFromScramble(t.scramble), dim: '', label: 'Your cube after this scramble' } :
  null;

  return (
    <aside className={`hidden min-h-0 flex-col border-l border-line bg-surface xl:flex ${className}`}>
      {cube &&
      <div
        ref={boxRef}
        className={`flex h-[clamp(200px,36vh,330px)] shrink-0 items-center justify-center border-b border-line transition-opacity duration-200 ease-out ${cube.dim}`}>
        
          <Cube3D state={cube.state} size={cubeSize} label={cube.label} />
        </div>
      }
      <SessionReadout cells={cells} />
      <HistoryHeader label="Attempts" count={n} onClear={onClear} />
      <ol aria-label="Attempts" className="scroll-quiet min-h-0 flex-1 overflow-y-auto py-2">
        <AnimatePresence initial={false}>
          {h.map((a, i) =>
          <motion.li
            key={a.id}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: EASE_OUT }}
            className="group relative">
            
              <div className="grid grid-cols-[30px_20px_1fr_auto] items-center py-[7px] pl-5 pr-10">
                <span className={`font-mono text-[10.5px] tnum ${i === 0 ? 'text-accent' : 'text-ink-3'}`}>{n - i}</span>
                {a.correct ?
              <CheckIcon size={13} className="text-ink-3" aria-label={t.mode === 'exec' ? 'solved' : 'correct'} /> :

              <XIcon size={13} className="text-accent" aria-label={t.mode === 'exec' ? 'DNF' : 'incorrect'} />
              }
                <span className={`font-mono text-[14.5px] tnum ${i === 0 ? 'text-ink' : 'text-ink-2'}`}>
                  {t.mode === 'exec' && !a.correct ? 'DNF' : formatTime(a.ms)}
                </span>
                <span className="font-mono text-[11px] text-ink-3 tnum">{t.mode === 'full' || t.mode === 'exec' ? `${a.pairs ?? 0} pairs` : a.targets}</span>
              </div>
              <RowDelete label={`Delete attempt ${n - i}`} onClick={() => t.removeAttempt(a.id)} />
            </motion.li>
          )}
        </AnimatePresence>
        {n === 0 && <li className="px-5 py-3 text-[12.5px] text-ink-3">No attempts yet</li>}
      </ol>
    </aside>);

}