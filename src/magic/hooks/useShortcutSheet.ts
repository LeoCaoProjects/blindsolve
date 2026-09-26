import { useEffect, useState } from 'react';
import { isTypingTarget } from '../utils/keyboard';

/** Global `?` toggle for the shortcut sheet on pages other than the Timer. */
export function useShortcutSheet() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || e.metaKey || e.ctrlKey) return;
      if (e.key === '?') setOpen((o) => !o);else
      if (open && e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  return { open, openSheet: () => setOpen(true), closeSheet: () => setOpen(false) };
}