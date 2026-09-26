import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { SessionStats, Solve } from '../../../types/solve';
import { EASE_OUT } from '../../../utils/keyboard';
import { SolveTime } from '../../solve/SolveTime';

interface WorkspaceHistoryProps {
  solves: Solve[];
  stats: SessionStats;
  onSelect: (id: string) => void;
}

/** Concept C — dense two-column time grid under a three-cell readout. */
export function WorkspaceHistory({ solves, stats, onSelect }: WorkspaceHistoryProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <dl className="grid shrink-0 grid-cols-3 border-b border-line">
        {[
        ['best', stats.best],
        ['mo3', stats.mo3],
        ['success', stats.success]].
        map(([label, value], i) =>
        <div key={label} className={`px-5 py-3.5 ${i > 0 ? 'border-l border-line' : ''}`}>
            <dt className="text-[11px] text-ink-3">{label}</dt>
            <dd className={`mt-1 font-mono text-[14px] tnum ${i === 0 ? 'text-ink' : 'text-ink-2'}`}>{value}</dd>
          </div>
        )}
      </dl>
      <ol aria-label="Solves" className="scroll-quiet grid min-h-0 flex-1 auto-rows-min grid-cols-2 overflow-y-auto py-2">
        <AnimatePresence initial={false}>
          {solves.map((s, i) =>
          <motion.li
            key={s.id}
            layout="position"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: EASE_OUT }}>
            
              <button
              type="button"
              onClick={() => onSelect(s.id)}
              className="grid w-full grid-cols-[30px_1fr] items-baseline px-5 py-[7px] text-left transition-colors duration-150 ease-out hover:bg-hover">
              
                <span className={`font-mono text-[10.5px] tnum ${i === 0 ? 'text-accent' : 'text-ink-3'}`}>{s.index}</span>
                <SolveTime
                time={s.time}
                penalty={s.penalty}
                showRaw={false}
                className={`font-mono text-[14.5px] ${i === 0 ? 'text-ink' : 'text-ink-2'}`} />
              
              </button>
            </motion.li>
          )}
        </AnimatePresence>
      </ol>
    </div>);

}