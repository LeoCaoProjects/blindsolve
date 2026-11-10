import React from "react";
import { useDialogFocus } from "../../hooks/useDialogFocus";
import { useDialogSpaceClose } from "../../hooks/useDialogSpaceClose";
import { motion } from "framer-motion";
import { EASE_OUT } from "../../utils/keyboard";
import { clamp, useElementSize } from "../../hooks/useElementSize";
import { CubeState } from "../../utils/cube";
import { Cube3D } from "../cube/Cube3D";
import { QuietButton } from "../common/PrimaryButton";
import { DELETE_BUTTON_STYLE } from "../common/destructiveStyle";

export const DETAILS_DELETE_BUTTON = DELETE_BUTTON_STYLE;

/** Extracted verbatim from Timer's saved-solve inspector. */
export function SolveDetailsShell({
  label,
  header,
  children,
  onClose,
  onDelete,
  deleteLabel,
  closeLabel = "Close",
}: {
  label: string;
  header: React.ReactNode;
  children: React.ReactNode;
  onClose: () => void;
  onDelete: () => void;
  deleteLabel: string;
  closeLabel?: string;
}) {
  const dialogRef = useDialogFocus<HTMLElement>(true, false, true);
  useDialogSpaceClose(dialogRef, onClose);
  return (
    <motion.div
      className="fixed inset-0 z-40 font-sans"
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
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
        data-dialog-autofocus
        style={{ outline: "none" }}
        aria-modal="true"
        aria-label={label}
        initial={{ x: 32, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 24, opacity: 0 }}
        transition={{ duration: 0.22, ease: EASE_OUT }}
        className="absolute inset-y-0 right-0 flex w-[min(780px,100vw)] flex-col border-l border-line bg-raised shadow-overlay"
      >
        {header}
        <div className="scroll-quiet min-h-0 flex-1 overflow-y-auto px-5 py-8 md:px-9">
          {children}
        </div>
        <SolveDetailsActions
          onClose={onClose}
          onDelete={onDelete}
          deleteLabel={deleteLabel}
          closeLabel={closeLabel}
        />
      </motion.section>
    </motion.div>
  );
}

/** Shared unchanged result action row; popup bodies choose their own layout. */
export function SolveDetailsActions({
  onClose,
  onDelete,
  deleteLabel,
  closeLabel = "Close",
  onDiscard,
  closeHint = "Esc",
  actionClassName = "",
}: {
  onClose: () => void;
  onDelete: () => void;
  deleteLabel: string;
  closeLabel?: string;
  onDiscard?: () => void;
  closeHint?: string;
  actionClassName?: string;
}) {
  return (
    <footer className="dock-inset flex shrink-0 items-center justify-between border-t border-line px-5 pt-3 text-[12.5px] md:px-9">
      <button
        type="button"
        onClick={onDelete}
        className={DETAILS_DELETE_BUTTON}
      >
        {deleteLabel}
      </button>
      <div className="ml-auto flex items-center gap-2">
        {onDiscard && (
          <QuietButton
            onClick={onDiscard}
            className={`border border-line-strong text-ink-2 ${actionClassName}`}
          >
            Close <span className="ml-3 text-[11px] text-ink-3">Esc</span>
          </QuietButton>
        )}
        <QuietButton
          onClick={onClose}
          className={`border border-line-strong text-ink-2 ${actionClassName}`}
        >
          {closeLabel}
          {!onDiscard && closeHint && (
            <span className="ml-3 text-[11px] text-ink-3">{closeHint}</span>
          )}
        </QuietButton>
      </div>
    </footer>
  );
}

export function DetailsSummaryBand({
  children,
  cube,
}: {
  children: React.ReactNode;
  cube?: CubeState;
}) {
  const [cubeRef, box] = useElementSize<HTMLDivElement>({
    width: 300,
    height: 300,
  });
  const cubeSize = clamp(Math.min(box.width, box.height) - 36, 130, 250);
  return (
    <div
      className={`grid h-[clamp(200px,34vh,300px)] shrink-0 grid-cols-1 border-b border-line bg-surface ${cube ? "sm:grid-cols-[minmax(0,1fr)_clamp(150px,34vh,300px)]" : ""}`}
    >
      <div className="flex min-w-0 flex-col px-5 py-[clamp(16px,3.5vh,32px)] md:px-9">
        {children}
      </div>
      {cube && (
        <div
          ref={cubeRef}
          className="hidden min-h-0 items-center justify-center overflow-hidden border-l border-line sm:flex"
        >
          <Cube3D state={cube} size={cubeSize} label="Cube after scramble" />
        </div>
      )}
    </div>
  );
}
