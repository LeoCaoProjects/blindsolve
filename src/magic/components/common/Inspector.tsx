import { designRem } from "../../hooks/useDesignPixels";
import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { EASE_OUT } from '../../utils/keyboard';
import { useDialogFocus } from '../../hooks/useDialogFocus';

interface InspectorProps {
  label: string;
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
  /** Close on scrim click */
  dismissable?: boolean;
}

/**
 * Right-hand inspector — same surface, scrim and motion as the Timer's reconstruction panel.
 * Below md it becomes a bottom sheet.
 */
export function Inspector({ label, onClose, children, width = 480, dismissable = true }: InspectorProps) {
  const dialogRef = useDialogFocus<HTMLElement>();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // A confirmation open on top handles its own Escape.
      if (e.key === 'Escape' && !e.defaultPrevented && !document.querySelector('[role="alertdialog"]')) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <motion.div className="fixed inset-0 z-40" initial={{ opacity: 1 }} exit={{ opacity: 1 }}>
      <motion.div
        className="absolute inset-0 bg-[var(--scrim)]"
        onClick={dismissable ? onClose : undefined}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }} />
      
      <motion.section
        role="dialog"
        ref={dialogRef}
        tabIndex={-1}
        aria-modal="true"
        aria-label={label}
        initial={{ x: 32, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 24, opacity: 0 }}
        transition={{ duration: 0.24, ease: EASE_OUT }}
        style={{ ['--inspector-w' as string]: designRem(width) }}
        className="absolute inset-x-0 bottom-0 flex max-h-[92dvh] flex-col rounded-t-[8px] border-t border-line bg-raised shadow-overlay md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[var(--inspector-w)] md:rounded-none md:border-l md:border-t-0">
        
        {children}
      </motion.section>
    </motion.div>);

}
