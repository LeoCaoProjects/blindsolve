import React, { useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { useDetailsKeys } from "../../../hooks/useDetailsKeys";
import { clamp, useElementSize } from "../../../hooks/useElementSize";
import { LetterPairDb, Penalty, Solve } from "../../../types/solve";
import { stateFromScramble } from "../../../utils/cube";
import { EASE_OUT } from "../../../utils/keyboard";
import { Cube3D } from "../../cube/Cube3D";
import { ScrambleText } from "../../solve/ScrambleText";
import { SolveMemoView } from "../../solve/SolveMemoView";

import { SolveSummary } from "../../solve/SolveSummary";
import { QuietButton } from "../../common/PrimaryButton";

interface Props {
  solve: Solve;
  db: LetterPairDb;
  onClose: () => void;
  onPenalty: (id: string, p: Penalty) => void;
  onDelete: (id: string) => void;
}

export function WorkspaceSolveDetails({
  solve,
  db,
  onClose,
  onPenalty,
  onDelete,
}: Props) {
  const setPenalty = useCallback(
    (p: Penalty) => onPenalty(solve.id, p),
    [onPenalty, solve.id],
  );
  useDetailsKeys(onClose, setPenalty);
  const cube = useMemo(
    () => stateFromScramble(solve.scramble),
    [solve.scramble],
  );
  const [cubeRef, box] = useElementSize<HTMLDivElement>({
    width: 300,
    height: 300,
  });
  const cubeSize = clamp(Math.min(box.width, box.height) - 36, 130, 250);

  return (
    <motion.div
      className="fixed inset-0 z-40"
      initial={{ opacity: 1 }}
      exit={{ opacity: 1 }}
    >
      <motion.div
        className="absolute inset-0 bg-[var(--scrim)]"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
      />

      <motion.section
        role="dialog"
        aria-modal="true"
        aria-label={`Solve ${solve.index}`}
        initial={{ x: 32, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 24, opacity: 0 }}
        transition={{ duration: 0.22, ease: EASE_OUT }}
        className="absolute inset-y-0 right-0 flex w-[min(780px,100vw)] flex-col border-l border-line bg-raised shadow-overlay"
      >
        <div className="grid shrink-0 grid-cols-1 border-b border-line sm:grid-cols-[minmax(0,1fr)_220px]">
          <div className="min-w-0 px-5 py-5 md:px-9">
            <SolveSummary
              date={solve.date}
              time={solve.time}
              memoTime={solve.memoTime}
              penalty={solve.penalty}
              onPenalty={setPenalty}
            />
          </div>
          <div
            ref={cubeRef}
            className="hidden min-h-0 items-center justify-center overflow-hidden sm:flex"
          >
            <Cube3D state={cube} size={cubeSize} label="Cube after scramble" />
          </div>
        </div>

        <div className="scroll-quiet min-h-0 flex-1 overflow-y-auto px-5 py-8 md:px-9">
          <ScrambleText
            scramble={solve.scramble}
            animate={false}
            className="text-[15px] leading-[1.75] text-ink"
          />
          <div className="mt-8 border-t border-line pt-7">
            <SolveMemoView memo={solve.memo} db={db} />
          </div>
        </div>

        <footer className="dock-inset flex shrink-0 items-center justify-between border-t border-line px-5 pt-3 text-[12.5px] md:px-9">
          <button
            type="button"
            onClick={() => onDelete(solve.id)}
            className="inline-flex h-9 items-center rounded-[4px] border border-[var(--danger)] bg-[var(--danger-soft)] px-3 text-[var(--danger)] transition-opacity hover:opacity-80"
          >
            Delete solve
          </button>
          <QuietButton
            onClick={onClose}
            className="border border-line-strong text-ink-2"
          >
            Close <span className="ml-3 text-[11px] text-ink-3">Esc</span>
          </QuietButton>
        </footer>
      </motion.section>
    </motion.div>
  );
}
