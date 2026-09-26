import React, { forwardRef } from 'react';
import { chunkPairs, tokenize } from '../../utils/pairs';

interface RecallInputProps {
  label: string;
  value: string;
  tokens: string[];
  onChange: (raw: string) => void;
  onEnter: () => void;
  autoFocus?: boolean;
  compact?: boolean;
}

/** Stores raw keystrokes; displays them token-aware, grouped into pairs. */
export const RecallInput = forwardRef<HTMLInputElement, RecallInputProps>(function RecallInput(
{ label, value, tokens, onChange, onEnter, autoFocus, compact },
ref)
{
  const parts = tokenize(value, tokens);
  const display = chunkPairs(parts).
  map((p) => p.some((t) => t.length > 1) ? p.join('·') : p.join('')).
  join('  ');
  return (
    <input
      ref={ref}
      autoFocus={autoFocus}
      aria-label={label}
      spellCheck={false}
      autoComplete="off"
      autoCapitalize="characters"
      value={display}
      onChange={(e) => onChange(e.target.value.toUpperCase().replace(/[^A-Z0-9·|,/\s]/g, ''))}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          onEnter();
        }
      }}
      className={`w-full whitespace-pre border-b border-line-strong bg-transparent pb-2 font-timer font-light tracking-[0.06em] text-ink caret-accent outline-none transition-colors duration-150 ease-out focus:border-accent ${
      compact ? 'text-[24px] md:text-[30px]' : 'text-[32px] md:text-[44px]'}`
      } />);


});
