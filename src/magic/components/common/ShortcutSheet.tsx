import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { shortcutSections } from '../../data/shortcuts';
import { EASE_OUT } from '../../utils/keyboard';
import { Kbd } from './Kbd';

interface ShortcutSheetProps {
  open: boolean;
  onClose: () => void;
  /** Section shown first */
  page?: string;
}

export function ShortcutSheet({ open, onClose, page = 'timer' }: ShortcutSheetProps) {
  const sections = [...shortcutSections].sort((a, b) => a.id === page ? -1 : b.id === page ? 1 : 0);
  return (
    <AnimatePresence>
      {open &&
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}>
        
          <div className="absolute inset-0 bg-[var(--scrim)]" onClick={onClose} />
          <motion.div
          role="dialog"
          aria-label="Keyboard shortcuts"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          transition={{ duration: 0.18, ease: EASE_OUT }}
          className="scroll-quiet relative max-h-[86dvh] w-[380px] overflow-y-auto rounded-[6px] border border-line bg-raised p-6 font-sans shadow-overlay">
          
            {sections.map((section, i) =>
          <section key={section.id} className={i > 0 ? 'mt-6 border-t border-line pt-5' : ''}>
                <h3 className={`text-[12px] ${section.id === page ? 'text-ink-2' : 'text-ink-3'}`}>{section.title}</h3>
                <ul className="mt-3 grid gap-2.5">
                  {section.items.map((s, j) =>
              <li key={j} className="flex items-center justify-between gap-6 text-[13px] text-ink-2">
                      <span>{s.label}</span>
                      <span className="flex gap-1">
                        {s.keys.map((k) =>
                  <Kbd key={k}>{k}</Kbd>
                  )}
                      </span>
                    </li>
              )}
                </ul>
              </section>
          )}
          </motion.div>
        </motion.div>
      }
    </AnimatePresence>);

}