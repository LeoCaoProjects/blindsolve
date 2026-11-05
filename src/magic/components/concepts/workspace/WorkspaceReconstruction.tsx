import React, { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { clamp, useElementSize } from "../../../hooks/useElementSize";
import {
  ReconResult,
  useReconstruction,
} from "../../../hooks/useReconstruction";
import { LetterPairDb, SolveDraft } from "../../../types/solve";
import { stateFromScramble } from "../../../utils/cube";
import { EASE_OUT } from "../../../utils/keyboard";
import { cubeHighlightFor } from "../../../utils/reconstruction";
import { PrimaryButton, QuietButton } from "../../common/PrimaryButton";
import { Cube3D } from "../../cube/Cube3D";
import { ReconStepBody } from "../../reconstruction/ReconStepBody";
import { StepTicks } from "../../reconstruction/StepTicks";

import { SolveSummary } from "../../solve/SolveSummary";

interface Props {
  draft: SolveDraft;
  db: LetterPairDb;
  onSave: (r: ReconResult) => void;
}

/** An inspector slides over the right of the workspace; the timer stays readable at left. */
export function WorkspaceReconstruction({ draft, db, onSave }: Props) {
  const r = useReconstruction({ draft, db, onSave });
  const cube = useMemo(
    () => stateFromScramble(draft.scramble),
    [draft.scramble],
  );
  const [cubeRef, box] = useElementSize<HTMLDivElement>({
    width: 300,
    height: 300,
  });
  const cubeSize = clamp(Math.min(box.width, box.height) - 28, 130, 260);

  return (
    <motion.div
      className="fixed inset-0 z-40"
      initial={{ opacity: 1 }}
      exit={{ opacity: 1 }}
    >
      <motion.div
        className="absolute inset-0 bg-[var(--scrim)]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      />

      <motion.section
        role="dialog"
        aria-modal="true"
        aria-label="Memo reconstruction"
        initial={{ x: 32, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 24, opacity: 0 }}
        transition={{ duration: 0.24, ease: EASE_OUT }}
        className="absolute inset-y-0 right-0 flex w-[min(780px,100vw)] flex-col border-l border-line bg-raised shadow-overlay"
      >
        <div className="grid h-[clamp(200px,34vh,300px)] shrink-0 grid-cols-1 border-b border-line bg-surface sm:grid-cols-[minmax(0,1fr)_clamp(150px,34vh,300px)]">
          <div className="flex min-w-0 flex-col px-5 py-[clamp(16px,3.5vh,32px)] md:px-9">
            <SolveSummary
              date={draft.date}
              time={draft.time}
              memoTime={draft.memoTime}
              penalty={r.penalty}
              onPenalty={r.setPenalty}
            />
          </div>
          <div
            ref={cubeRef}
            className="hidden min-h-0 items-center justify-center overflow-hidden border-l border-line sm:flex"
          >
            <Cube3D
              state={cube}
              size={cubeSize}
              highlight={cubeHighlightFor(r, cube)}
              label="Cube at the start of memo"
            />
          </div>
        </div>

        <div className="flex h-11 shrink-0 items-center px-5 md:px-9">
          <StepTicks total={r.steps.length} index={r.index} />
        </div>

        <div className="scroll-quiet min-h-0 flex-1 overflow-y-auto px-5 pb-8 pt-3 md:px-9">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={r.index}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.16, ease: EASE_OUT }}
            >
              <ReconStepBody r={r} />
            </motion.div>
          </AnimatePresence>
        </div>

        <footer className="dock-inset flex shrink-0 items-center justify-end gap-2 border-t border-line px-5 pt-3.5 md:px-6">
          {r.step.kind !== "review" ? (
            <QuietButton onClick={r.finish}>Skip to save</QuietButton>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            {r.index > 0 && <QuietButton onClick={r.back}>Back</QuietButton>}
            <PrimaryButton hint="" onClick={r.primary}>
              {r.primaryLabel}
            </PrimaryButton>
          </div>
        </footer>
      </motion.section>
    </motion.div>
  );
}
