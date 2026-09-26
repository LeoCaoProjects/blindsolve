import React, { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { XIcon } from 'lucide-react';
import { EASE_OUT } from '../../utils/keyboard';
import { IconButton } from './IconButton';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  label: string;
  title?: React.ReactNode;
  width?: number;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

/** Centred sheet — same scrim, surface and motion as the shortcut sheet. Scrolls inside, never past the viewport. */
export function Sheet({ open, onClose, label, title, width = 420, footer, children }: SheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open &&
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}>
        
          <div className="absolute inset-0 bg-[var(--scrim)]" onClick={onClose} />
          <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={label}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          transition={{ duration: 0.18, ease: EASE_OUT }}
          style={{ width: `min(${width}px, 100%)` }}
          className="relative flex max-h-[min(86dvh,760px)] flex-col overflow-hidden rounded-[6px] border border-line bg-raised font-sans shadow-overlay">
          
            {title &&
          <header className="flex shrink-0 items-center justify-between gap-4 py-3 pl-6 pr-3">
                <h2 className="text-[13.5px] text-ink">{title}</h2>
                <IconButton size="sm" label="Close" onClick={onClose}>
                  <XIcon />
                </IconButton>
              </header>
          }
            <div className={`scroll-quiet min-h-0 flex-1 overflow-y-auto px-6 ${title ? 'pb-6' : 'py-6'}`}>{children}</div>
            {footer && <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-line px-4 py-3">{footer}</footer>}
          </motion.div>
        </motion.div>
      }
    </AnimatePresence>);

}