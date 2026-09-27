import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { EASE_OUT } from '../../utils/keyboard';

interface PopoverProps {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  label: string;
  width?: number;
  children: React.ReactNode;
}

/**
 * Small floating panel anchored to a control. Rendered above everything (portal), so opening it
 * never resizes the row it came from. Closes on outside click, Escape, or when its owner says so.
 */
export function Popover({ open, onClose, anchorRef, label, width = 216, children }: PopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{top: number;left: number;above: boolean;} | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const place = () => {
      const a = anchorRef.current?.getBoundingClientRect();
      if (!a) return;
      const h = panelRef.current?.offsetHeight ?? 180;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const fitsBelow = a.bottom + 6 + h <= vh - 12;
      const top = fitsBelow ? a.bottom + 6 : Math.max(12, a.top - 6 - h);
      const left = Math.min(Math.max(12, a.right - width), vw - width - 12);
      setPos({ top, left, above: !fitsBelow });
    };
    place();
    const raf = requestAnimationFrame(place);
    // Content can change height (e.g. "More"); re-place without re-rendering in a loop.
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(place) : null;
    if (panelRef.current) ro?.observe(panelRef.current);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, width, anchorRef]);

  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || anchorRef.current?.contains(t)) return;
      onClose();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopImmediatePropagation();
      onClose();
      anchorRef.current?.focus();
    };
    document.addEventListener('pointerdown', down, true);
    window.addEventListener('keydown', key, true);
    return () => {
      document.removeEventListener('pointerdown', down, true);
      window.removeEventListener('keydown', key, true);
    };
  }, [open, onClose, anchorRef]);

  return createPortal(
    <AnimatePresence>
      {open &&
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-label={label}
        initial={{ opacity: 0, y: pos?.above ? 3 : -3, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.1 } }}
        transition={{ duration: 0.15, ease: EASE_OUT }}
        style={{
          position: 'fixed',
          top: pos?.top ?? -9999,
          left: pos?.left ?? -9999,
          width,
          transformOrigin: pos?.above ? 'bottom right' : 'top right'
        }}
        className="z-[70] rounded-[6px] border border-line-strong bg-raised p-1 font-sans shadow-overlay">
        
          {children}
        </motion.div>
      }
    </AnimatePresence>,
    document.body
  );
}

/** Keyboard helper for vertical menus inside a popover: arrow keys move between items. */
export function onMenuKeyDown(e: React.KeyboardEvent<HTMLElement>) {
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
  const items = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
  const i = items.indexOf(document.activeElement as HTMLButtonElement);
  const next = e.key === 'ArrowDown' ? items[(i + 1) % items.length] : items[(i - 1 + items.length) % items.length];
  next?.focus();
  e.preventDefault();
}
