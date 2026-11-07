import React, { useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useDialogFocus } from "../../hooks/useDialogFocus";
import { useDialogSpaceClose } from "../../hooks/useDialogSpaceClose";
import { designRem } from "../../hooks/useDesignPixels";
import { EASE_OUT } from "../../utils/keyboard";

/** The shared sheet language, sized around editing one pair. */
export function PairEditorDialog({
  label,
  onClose,
  children,
}: {
  label: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useDialogFocus<HTMLElement>();
  const reduced = useReducedMotion();
  useDialogSpaceClose(ref, onClose);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        event.key !== "Escape" ||
        event.defaultPrevented ||
        document.querySelector('[role="alertdialog"]')
      )
        return;
      event.preventDefault();
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <motion.div
      className="fixed inset-0 z-40 flex items-center justify-center p-3 md:p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduced ? 0 : 0.15 }}
    >
      <div
        className="absolute inset-0 bg-[var(--scrim)]"
        onClick={onClose}
        aria-hidden
      />
      <motion.section
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        initial={{ y: reduced ? 0 : 6 }}
        animate={{ y: 0 }}
        exit={{ y: reduced ? 0 : 4 }}
        transition={{ duration: reduced ? 0 : 0.18, ease: EASE_OUT }}
        style={{
          width: `min(${designRem(460)}, 100%)`,
          height: `min(${designRem(520)}, 90dvh)`,
        }}
        className="relative flex max-h-[90dvh] flex-col overflow-hidden rounded-[6px] border border-line bg-raised font-sans text-ink shadow-overlay"
      >
        {children}
      </motion.section>
    </motion.div>
  );
}
