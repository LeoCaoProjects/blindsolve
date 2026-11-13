import React, { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { clamp, useElementSize } from "../../hooks/useElementSize";
import {
  ReconResult,
  useReconstruction,
} from "../../hooks/useReconstruction";
import { LetterPairDb, SolveDraft } from "../../types/solve";
import { stateFromScramble } from "../../utils/cube";
import { EASE_OUT } from "../../utils/keyboard";
import { cubeHighlightFor } from "../../utils/reconstruction";
import { QuietButton } from "../common/PrimaryButton";
import { SchemeCube } from "../cube/SchemeCube";
import { SolveDetailsActionRow } from "../solve/SolveDetailsShell";
import { ReconStepBody } from "../reconstruction/ReconStepBody";
import { StepTicks } from "../reconstruction/StepTicks";

import { useShortPhoneViewport } from "../../hooks/useShortPhoneViewport";
import { SolveSummary } from "../solve/SolveSummary";

interface Props {
  draft: SolveDraft;
  db: LetterPairDb;
  onSave: (r: ReconResult) => void;
}

/** An inspector slides over the right of the workspace; the timer stays readable at left. */
export function WorkspaceReconstruction({ draft, db, onSave }: Props) {
  const r = useReconstruction({ draft, db, onSave });
  const compactReview = useShortPhoneViewport() && r.step.kind === "review";
  const cube = useMemo(
    () => stateFromScramble(draft.scramble),
    [draft.scramble],
  );
  const [cubeRef, box] = useElementSize<HTMLDivElement>({
    width: 300,
    height: 300,
  });
  const highlight = cubeHighlightFor(r, cube);
  const targets = highlight?.targets ?? [];
  const selected =
    targets.find(
      (target) =>
        target.value ===
        (r.step.kind === "break" ? r.step.options[r.optionFocus] : undefined),
    )?.id ?? null;
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
        <div
          className={`grid shrink-0 grid-cols-1 border-b border-line bg-surface sm:grid-cols-[minmax(0,1fr)_clamp(150px,34vh,300px)] ${compactReview ? "h-[150px]" : "h-[clamp(200px,34vh,300px)]"}`}
        >
          <div
            className={`flex min-w-0 flex-col px-5 md:px-9 ${compactReview ? "py-3" : "py-[clamp(16px,3.5vh,32px)]"}`}
          >
            <SolveSummary
              compact={compactReview}
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
            <SchemeCube
              state={cube}
              size={cubeSize}
              scheme={Object.fromEntries(
                targets.map((target) => [target.id, target.value]),
              )}
              mode={highlight ? "lettering" : "static"}
              selected={selected}
              revealSelected={!!highlight}
              animateOrientation
              freeRotation
              pickableIds={targets.map((target) => target.id)}
              hideLetters={!highlight}
              onPick={(id) => {
                const target = targets.find((target) => target.id === id);
                if (target) r.focusBreak(target.value);
              }}
              onConfirm={(id) => {
                const target = targets.find((target) => target.id === id);
                if (target) r.pickBreak(target.value);
              }}
              label="Cube at the start of memo"
            />
          </div>
        </div>

        {r.step.kind !== "review" && (
          <div className="flex h-11 shrink-0 items-center px-5 md:px-9">
            <StepTicks total={r.steps.length} index={r.index} />
          </div>
        )}

        <div
          className={`min-h-0 flex-1 px-5 md:px-9 ${r.step.kind === "review" ? `flex flex-col overflow-hidden ${compactReview ? "py-4" : "py-8"}` : "scroll-quiet overflow-y-auto pb-8 pt-3"}`}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              className={
                r.step.kind === "review"
                  ? "flex min-h-0 flex-1 flex-col"
                  : undefined
              }
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

        <SolveDetailsActionRow
          leading={
            r.step.kind !== "review" ? (
              <QuietButton onClick={r.finish}>Skip to save</QuietButton>
            ) : undefined
          }
        >
          {r.canBack && (
            <QuietButton
              onClick={r.back}
              className="border border-line-strong text-ink-2"
            >
              Back
            </QuietButton>
          )}
          <QuietButton
            onClick={r.primary}
            aria-disabled={
              r.step.kind === "review" && !r.canSave ? true : undefined
            }
            className="min-w-[84px] justify-center border border-line-strong text-ink-2"
          >
            {r.primaryLabel}
          </QuietButton>
        </SolveDetailsActionRow>
      </motion.section>
    </motion.div>
  );
}
