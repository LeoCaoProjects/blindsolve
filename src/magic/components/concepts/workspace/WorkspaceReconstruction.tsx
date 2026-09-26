import React, { useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ReconResult, useReconstruction } from '../../../hooks/useReconstruction';
import { LetterPairDb, SolveDraft } from '../../../types/solve';
import { stateFromScramble } from '../../../utils/cube';
import { EASE_OUT } from '../../../utils/keyboard';
import { cubeHighlightFor } from '../../../utils/reconstruction';
import { PrimaryButton, QuietButton } from '../../common/PrimaryButton';
import { Cube3D } from '../../cube/Cube3D';
import { ReconStepBody } from '../../reconstruction/ReconStepBody';
import { StepTicks } from '../../reconstruction/StepTicks';
import { ResultControl } from '../../solve/ResultControl';
import { SolveTime } from '../../solve/SolveTime';
import { SplitMeter } from '../../solve/SplitMeter';

interface Props {
  draft: SolveDraft;
  db: LetterPairDb;
  onSave: (r: ReconResult) => void;
}

/** Concept C — an inspector slides over the right of the workspace; the timer stays readable at left. */
export function WorkspaceReconstruction({ draft, db, onSave }: Props) {
  const r = useReconstruction({ draft, db, onSave });
  const cube = useMemo(() => stateFromScramble(draft.scramble), [draft.scramble]);

  return (
    <motion.div className="fixed inset-0 z-40" initial={{ opacity: 1 }} exit={{ opacity: 1 }}>
      <motion.div
        className="absolute inset-0 bg-[var(--scrim)]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }} />
      
      <motion.section
        role="dialog"
        aria-modal="true"
        aria-label="Memo reconstruction"
        initial={{ x: 32, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 24, opacity: 0 }}
        transition={{ duration: 0.24, ease: EASE_OUT }}
        className="absolute inset-y-0 right-0 flex w-full max-w-[780px] flex-col overflow-y-auto border-l border-line bg-raised shadow-overlay">
        
        <div className="grid shrink-0 grid-cols-1 border-b border-line bg-surface sm:h-[300px] sm:grid-cols-[minmax(0,1fr)_300px]">
          <div className="flex min-h-[190px] flex-col px-5 py-6 sm:px-9 sm:py-8">
            <SolveTime
              time={draft.time}
              penalty={r.penalty}
              className="font-timer text-[60px] font-extralight leading-none tracking-[-0.05em] text-ink" />
            
            {draft.memoTime !== undefined && r.penalty !== 'dnf' &&
            <SplitMeter memo={draft.memoTime} total={draft.time} className="mt-5 w-[260px]" />
            }
            <ResultControl className="mt-auto self-start" value={r.penalty} onChange={r.setPenalty} />
          </div>
          <div className="flex h-[220px] items-center justify-center border-t border-line sm:h-auto sm:border-l sm:border-t-0">
            <Cube3D state={cube} size={260} className="scale-[.84] sm:scale-100" highlight={cubeHighlightFor(r)} label="Cube at the start of memo" />
          </div>
        </div>

        <div className="flex h-11 shrink-0 items-center px-5 sm:px-9">
          <StepTicks total={r.steps.length} index={r.index} />
        </div>

        <div className="scroll-quiet min-h-0 flex-1 overflow-y-auto px-5 pb-8 pt-3 sm:px-9">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={r.index}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.16, ease: EASE_OUT }}>
              
              <ReconStepBody r={r} />
            </motion.div>
          </AnimatePresence>
        </div>

        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3.5 sm:px-6">
          {r.step.kind !== 'review' ? <QuietButton onClick={r.finish}>Skip to save</QuietButton> : <span />}
          <div className="flex items-center gap-2">
            {r.index > 0 && <QuietButton onClick={r.back}>Back</QuietButton>}
            <PrimaryButton onClick={r.primary}>{r.primaryLabel}</PrimaryButton>
          </div>
        </footer>
      </motion.section>
    </motion.div>);

}
