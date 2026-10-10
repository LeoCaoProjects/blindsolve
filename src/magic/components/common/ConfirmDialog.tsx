import React, { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { EASE_OUT } from '../../utils/keyboard';
import { useDialogFocus } from '../../hooks/useDialogFocus';

interface Action {
  label: string;
  onClick: () => void;
  /** 'danger' for actions that remove saved data */
  tone?: 'default' | 'danger';
}

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  body?: React.ReactNode;
  confirm: Action;
  secondary?: Action;
  onCancel: () => void;
  cancelLabel?: string;
  width?: number;
  children?: React.ReactNode;
}

export function ConfirmDialog({ open, title, body, confirm, secondary, onCancel, cancelLabel = 'Cancel', width = 420, children }: ConfirmDialogProps) {
  const dialogRef = useDialogFocus<HTMLDivElement>(open);
  const actionLocked = useRef(false);
  const runAction = (action: Action) => {
    if (actionLocked.current) return;
    actionLocked.current = true;
    action.onClick();
    queueMicrotask(() => {
      actionLocked.current = false;
    });
  };
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  return (
    <AnimatePresence>
      {open &&
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.16, ease: 'easeOut' }}>
        
          <div className="absolute inset-0 bg-[var(--scrim)]" onClick={onCancel} />
          <motion.div
          role="alertdialog"
          ref={dialogRef}
          tabIndex={-1}
          aria-modal="true"
          aria-label={title}
          initial={{ opacity: 0, y: 8, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 4, scale: 0.99 }}
          transition={{ duration: 0.2, ease: EASE_OUT }}
          style={{ width }}
          className="relative max-w-full rounded-[6px] border border-line bg-raised font-sans shadow-overlay">
          
            <div className="px-7 pb-6 pt-6">
              <h2 className="text-[15px] font-medium text-ink">{title}</h2>
              {body && <div className="mt-2 text-[13.5px] leading-relaxed text-ink-2">{body}</div>}
              {children}
            </div>
            <footer className="flex items-center justify-end gap-2 border-t border-line px-5 py-3.5">
              <button
              type="button"
              data-dialog-autofocus
              onClick={onCancel}
              className="inline-flex h-9 items-center rounded-[4px] px-3 text-[13px] text-ink-3 transition-colors duration-150 ease-out hover:bg-hover hover:text-ink-2">
              
                {cancelLabel}
              </button>
              {secondary &&
            <button
              type="button"
              onClick={() => runAction(secondary)}
              className="inline-flex h-9 items-center rounded-[4px] border border-line-strong px-3.5 text-[13px] text-ink transition-colors duration-150 ease-out hover:bg-hover">
              
                  {secondary.label}
                </button>
            }
              <button
              type="button"
              onClick={() => runAction(confirm)}
              className={`inline-flex h-9 items-center rounded-[4px] px-4 text-[13px] font-medium transition-opacity duration-150 ease-out hover:opacity-90 ${
              confirm.tone === 'danger' ? 'bg-[var(--danger-strong)] text-white' : 'bg-ink text-bg'}`
              }>
              
                {confirm.label}
              </button>
            </footer>
          </motion.div>
        </motion.div>
      }
    </AnimatePresence>);

}
