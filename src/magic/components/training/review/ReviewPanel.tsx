import { designRem } from "../../../hooks/useDesignPixels";
import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { EASE_OUT, isTypingTarget } from '../../../utils/keyboard';
import { PrimaryButton, QuietButton } from '../../common/PrimaryButton';

export interface PendingEdits {
  count: number;
  onSave: () => void;
  onCancel: () => void;
  saveLabel?: string;
  cancelLabel?: string;
  /** Singular / plural noun for the footer count, e.g. ['change', 'changes'] */
  noun?: [string, string];
}

interface ReviewPanelProps {
  label: string;
  /** Summary: status, time, key numbers */
  header: React.ReactNode;
  children: React.ReactNode;
  onNext: () => void;
  footerStart?: React.ReactNode;
  /** Unsaved word edits: the footer switches to Cancel / Save until they're resolved */
  pending?: PendingEdits | null;
  width?: number;
}

/**
 * One review surface for every drill: the reconstruction panel's language. Scrim, right-hand
 * sheet, summary on top, internal scroll, actions held in an inset footer.
 * Clicking the scrim is the same as Next, unless there are unsaved edits.
 */
export function ReviewPanel({ label, header, children, onNext, footerStart, pending, width = 820 }: ReviewPanelProps) {
  const hasPending = !!pending && pending.count > 0;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey) return;
      if (document.querySelector('[role="alertdialog"]')) return;
      if (e.key === 'Escape' && hasPending) {
        e.preventDefault();
        pending?.onCancel();
        return;
      }
      if (e.key !== 'Enter') return;
      if (isTypingTarget(e.target) || e.target instanceof HTMLButtonElement) return;
      e.preventDefault();
      if (hasPending) pending?.onSave();else
      onNext();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onNext, hasPending, pending]);

  return (
    <motion.div className="fixed inset-0 z-40" initial={{ opacity: 1 }} exit={{ opacity: 1 }}>
      <motion.div
        className={`absolute inset-0 bg-[var(--scrim)] ${hasPending ? '' : 'cursor-pointer'}`}
        onClick={() => !hasPending && onNext()}
        aria-hidden
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }} />
      
      <motion.section
        role="dialog"
        aria-modal="true"
        aria-label={label}
        initial={{ x: 32, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 24, opacity: 0 }}
        transition={{ duration: 0.24, ease: EASE_OUT }}
        style={{ width: `min(${designRem(width)}, 100vw)` }}
        className="absolute inset-y-0 right-0 flex flex-col border-l border-line bg-raised shadow-overlay">
        
        {header}
        <div className="scroll-quiet min-h-0 flex-1 overflow-y-auto px-5 py-[clamp(16px,3.5vh,28px)] md:px-9">{children}</div>
        <footer className="dock-inset flex shrink-0 items-center justify-between gap-3 border-t border-line px-5 pt-3.5 md:px-6">
          <div className="min-w-0 text-[12.5px] text-ink-3">
            {hasPending ?
            `${pending!.count} unsaved ${pending!.count === 1 ? pending!.noun?.[0] ?? 'word' : pending!.noun?.[1] ?? 'words'}` :
            footerStart}
          </div>
          {hasPending ?
          <div className="flex items-center gap-1">
              <QuietButton onClick={pending!.onCancel}>
                {pending!.cancelLabel ?? 'Cancel'} <span className="ml-2 font-mono text-[11px]">esc</span>
              </QuietButton>
              <PrimaryButton onClick={pending!.onSave}>{pending!.saveLabel ?? 'Save'}</PrimaryButton>
            </div> :

          <PrimaryButton onClick={onNext}>Next</PrimaryButton>
          }
        </footer>
      </motion.section>
    </motion.div>);

}

/** Standard summary band for the top of a review sheet. */
export function ReviewHeader({ children }: {children: React.ReactNode;}) {
  return <header className="shrink-0 border-b border-line bg-surface px-5 py-[clamp(16px,3.5vh,30px)] md:px-9">{children}</header>;
}