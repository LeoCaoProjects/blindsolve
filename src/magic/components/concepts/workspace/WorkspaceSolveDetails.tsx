import React, { useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { XIcon } from 'lucide-react';
import { useDetailsKeys } from '../../../hooks/useDetailsKeys';
import { LetterPairDb, Penalty, Solve } from '../../../types/solve';
import { stateFromScramble } from '../../../utils/cube';
import { EASE_OUT } from '../../../utils/keyboard';
import { formatSolveDate } from '../../../utils/time';
import { IconButton } from '../../common/IconButton';
import { Cube3D } from '../../cube/Cube3D';
import { ResultControl } from '../../solve/ResultControl';
import { ScrambleText } from '../../solve/ScrambleText';
import { SolveMemoView } from '../../solve/SolveMemoView';
import { SolveTime } from '../../solve/SolveTime';
import { SplitMeter } from '../../solve/SplitMeter';

interface Props {
  solve: Solve;
  db: LetterPairDb;
  onClose: () => void;
  onPenalty: (id: string, p: Penalty) => void;
  onDelete: (id: string) => void;
}

export function WorkspaceSolveDetails({ solve, db, onClose, onPenalty, onDelete }: Props) {
  const setPenalty = useCallback((p: Penalty) => onPenalty(solve.id, p), [onPenalty, solve.id]);
  useDetailsKeys(onClose, setPenalty);
  const cube = useMemo(() => stateFromScramble(solve.scramble), [solve.scramble]);

  return (
    <motion.div className="fixed inset-0 z-40" initial={{ opacity: 1 }} exit={{ opacity: 1 }}>
      <motion.div
        className="absolute inset-0 bg-[var(--scrim)]"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18, ease: 'easeOut' }} />
      
      <motion.section
        role="dialog"
        aria-modal="true"
        aria-label={`Solve ${solve.index}`}
        initial={{ x: 32, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 24, opacity: 0 }}
        transition={{ duration: 0.22, ease: EASE_OUT }}
        className="absolute inset-y-0 right-0 flex w-[min(780px,100vw)] flex-col border-l border-line bg-raised shadow-overlay">
        
        <div className="grid h-[300px] shrink-0 grid-cols-[minmax(0,1fr)_300px] border-b border-line bg-surface">
          <div className="flex flex-col px-9 py-8">
            <div className="flex items-center justify-between">
              <p className="flex items-baseline gap-3 text-[12.5px] text-ink-3">
                <span className="font-mono tnum">#{solve.index}</span>
                <time dateTime={solve.date}>{formatSolveDate(solve.date)}</time>
              </p>
            </div>
            <SolveTime
              time={solve.time}
              penalty={solve.penalty}
              className="mt-3 font-timer text-[60px] font-extralight leading-none tracking-[-0.05em] text-ink" />
            
            {solve.memoTime !== undefined &&
            <SplitMeter memo={solve.memoTime} total={solve.time} showLabels className="mt-5 w-[280px]" />
            }
            <ResultControl className="mt-auto self-start" value={solve.penalty} onChange={setPenalty} />
          </div>
          <div className="relative flex items-center justify-center border-l border-line">
            <IconButton label="Close" onClick={onClose} className="absolute right-3 top-3">
              <XIcon />
            </IconButton>
            <Cube3D state={cube} size={250} label="Cube after scramble" />
          </div>
        </div>

        <div className="scroll-quiet min-h-0 flex-1 overflow-y-auto px-9 py-8">
          <ScrambleText scramble={solve.scramble} animate={false} className="text-[15px] leading-[1.75] text-ink" />
          <div className="mt-8 border-t border-line pt-7">
            <SolveMemoView memo={solve.memo} db={db} />
          </div>
        </div>

        <footer className="flex shrink-0 items-center justify-between border-t border-line px-9 py-3 text-[12.5px]">
          <button
            type="button"
            onClick={() => onDelete(solve.id)}
            className="text-ink-3 transition-colors duration-150 ease-out hover:text-ink-2">
            
            Delete solve
          </button>
          <span className="font-mono text-[11px] text-ink-3">esc</span>
        </footer>
      </motion.section>
    </motion.div>);

}