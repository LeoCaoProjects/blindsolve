import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';

interface ScrambleTextProps {
  scramble: string;
  className?: string;
  align?: 'start' | 'center';
  animate?: boolean;
}

export function ScrambleText({ scramble, className = '', align = 'start', animate = true }: ScrambleTextProps) {
  const moves = scramble.trim().split(/\s+/);
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.p
        key={scramble}
        initial={animate ? { opacity: 0 } : false}
        animate={{ opacity: 1 }}
        exit={animate ? { opacity: 0 } : undefined}
        transition={{ duration: 0.12, ease: 'easeOut' }}
        className={`flex flex-wrap font-mono ${align === 'center' ? 'justify-center' : ''} ${className}`}>
        <span className="sr-only">Scramble {scramble}</span>
        {moves.map((m, i) =>
        <span key={i} aria-hidden className="inline-block w-[3.7ch] whitespace-pre">
            {m}
          </span>
        )}
      </motion.p>
    </AnimatePresence>);

}
