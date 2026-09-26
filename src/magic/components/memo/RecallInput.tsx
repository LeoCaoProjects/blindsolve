import React, { forwardRef } from 'react';
import { chunkPairs, tokenize } from '../../utils/pairs';

interface RecallInputProps {
  label: string;
  value: string;
  tokens: string[];
  onChange: (raw: string) => void;
  onEnter: () => void;
  autoFocus?: boolean;
  /** Framed field for timed answer entry beside a cube (Trace Sprint) */
  compact?: boolean;
  /** Visible caption above a compact field, e.g. "Corners" */
  caption?: string;
}

/** Stores raw keystrokes; displays them token-aware, grouped into pairs. */
export const RecallInput = forwardRef<HTMLInputElement, RecallInputProps>(function RecallInput(
{ label, value, tokens, onChange, onEnter, autoFocus, compact, caption },
ref)
{
  const parts = tokenize(value, tokens);
  const display = chunkPairs(parts).
  map((p) => p.some((t) => t.length > 1) ? p.join('·') : p.join('')).
  join('  ');

  const input =
  <input
    ref={ref}
    autoFocus={autoFocus}
    aria-label={label}
    spellCheck={false}
    autoComplete="off"
    autoCapitalize="characters"
    value={display}
    onChange={(e) => onChange(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
    onKeyDown={(e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        onEnter();
      }
    }}
    className={
    compact ?
    'h-full w-full min-w-0 whitespace-pre bg-transparent font-mono text-[clamp(18px,2vw,22px)] tracking-[0.08em] text-ink caret-accent outline-none placeholder:text-ink-3' :
    'w-full whitespace-pre border-b border-line-strong bg-transparent pb-2 font-timer text-[32px] font-light tracking-[0.06em] text-ink caret-accent outline-none transition-colors duration-150 ease-out focus:border-accent md:text-[44px]'
    } />;



  if (!compact) return input;
  return (
    <FieldFrame caption={caption} count={parts.length ? `${parts.length}` : undefined}>
      {input}
    </FieldFrame>);

});

/** Shared frame for timed answer fields: caption row, then a calm framed input. */
export function FieldFrame({ caption, count, children }: {caption?: string;count?: string;children: React.ReactNode;}) {
  return (
    <div>
      {(caption || count) &&
      <div className="mb-1.5 flex items-baseline justify-between px-0.5">
          <span className="text-[12px] text-ink-3">{caption}</span>
          <span className="font-mono text-[11px] text-ink-3 tnum">{count}</span>
        </div>
      }
      <div className="flex min-h-[52px] items-center rounded-[5px] border border-line bg-surface px-4 transition-colors duration-150 ease-out focus-within:border-line-strong">
        {children}
      </div>
    </div>);

}