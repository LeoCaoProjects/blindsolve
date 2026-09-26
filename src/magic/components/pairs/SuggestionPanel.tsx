import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Suggestion, curatedSuggestions, fallbackWords } from '../../data/suggestions';
import { EASE_OUT } from '../../utils/keyboard';

interface SuggestionPanelProps {
  first: string;
  second: string;
  onPick: (word: string) => void;
  current?: string;
}

const INITIAL = 6;

export function getSuggestions(first: string, second: string): Suggestion[] {
  const curated = curatedSuggestions[first + second];
  if (curated) return curated;
  const a = first.toLowerCase();
  const b = second.toLowerCase();
  return fallbackWords.filter((s) => s.word.startsWith(a) && s.word.slice(1).includes(b)).slice(0, 12);
}

export function SuggestionPanel({ first, second, onPick, current }: SuggestionPanelProps) {
  const all = useMemo(() => getSuggestions(first, second), [first, second]);
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? all : all.slice(0, INITIAL);

  if (!all.length) {
    return <p className="text-[13px] text-ink-3">Nothing for this pair yet.</p>;
  }

  return (
    <div>
      <ul className="grid grid-cols-2 gap-x-2">
        <AnimatePresence initial={false}>
          {visible.map((s, i) => {
            const active = current?.toLowerCase() === s.word.toLowerCase();
            return (
              <motion.li
                key={s.word}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.16, ease: EASE_OUT, delay: i >= INITIAL ? (i - INITIAL) * 0.03 : i * 0.03 }}>
                
                <button
                  type="button"
                  onClick={() => onPick(s.word)}
                  className={`-mx-2 flex w-full items-baseline justify-between gap-3 rounded-[4px] px-2 py-2 text-left transition-colors duration-150 ease-out hover:bg-hover ${
                  active ? 'text-ink' : 'text-ink-2 hover:text-ink'}`
                  }>
                  
                  <span className="truncate text-[13.5px]">{s.word}</span>
                  <span className="shrink-0 text-[11px] text-ink-3">{s.kind}</span>
                </button>
              </motion.li>);

          })}
        </AnimatePresence>
      </ul>
      {all.length > INITIAL &&
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mt-2 text-[12.5px] text-ink-3 transition-colors duration-150 ease-out hover:text-ink-2">
        
          {expanded ? 'Fewer' : `${all.length - INITIAL} more`}
        </button>
      }
    </div>);

}