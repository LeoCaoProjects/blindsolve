import React from 'react';
import { memoPairTokens } from '../../../domain/letterPairs/identity';

type TraceSize = 'sm' | 'md' | 'lg' | 'xl';

interface MemoTraceProps {
  pairs: string[];
  breakAt?: number | null;
  resolved?: boolean;
  activePair?: string | null;
  words?: string[];
  renderWord?: (pair: string, i: number) => React.ReactNode;
  hideWords?: boolean;
  /** Keep the historical pair-over-word presentation in one untruncated row. */
  nowrap?: boolean;
  size?: TraceSize;
  className?: string;
}

const LETTER_SIZE: Record<TraceSize, string> = {
  sm: 'text-[13px]',
  md: 'text-[17px]',
  lg: 'text-[22px]',
  xl: 'text-[30px]'
};
const WORD_SIZE: Record<TraceSize, string> = {
  sm: 'text-[11.5px]',
  md: 'text-[12.5px]',
  lg: 'text-[13.5px]',
  xl: 'text-[15px]'
};
const GAP: Record<TraceSize, string> = {
  sm: 'gap-x-4 gap-y-2',
  md: 'gap-x-6 gap-y-4',
  lg: 'gap-x-7 gap-y-5',
  xl: 'gap-x-9 gap-y-6'
};

/**
 * Letter pairs set as a typographic sequence: letters above, the image word beneath.
 * An unresolved cycle break renders as an open slot; a resolved one as a hairline cut.
 */
export function MemoTrace({
  pairs,
  breakAt = null,
  resolved = true,
  activePair = null,
  words,
  renderWord,
  hideWords = false,
  nowrap = false,
  size = 'md',
  className = ''
}: MemoTraceProps) {
  return (
    <ol className={`flex ${nowrap ? 'flex-nowrap' : 'flex-wrap'} ${GAP[size]} ${className}`}>
      {pairs.map((pair, i) => {
        const start = i * 2;
        const tokens = memoPairTokens(pair);
        const displayTokens = tokens.length ? tokens : [pair]; // Opaque historical display, never used as a lookup key.
        const pending = breakAt !== null && !resolved && start + displayTokens.length - 1 >= breakAt;
        const active = activePair === pair;
        return (
          <li key={`${pair}-${i}`} className={`flex min-w-[2.6ch] flex-col ${nowrap ? 'shrink-0 whitespace-nowrap' : ''}`}>
            <span
              className={`font-mono leading-none tracking-[0.14em] ${LETTER_SIZE[size]} ${
              active ? 'text-accent' : 'text-ink'}`
              }>
              
              {displayTokens.map((letter, j) => {
                const idx = start + j;
                if (breakAt !== null && !resolved && idx >= breakAt) {
                  return idx === breakAt ?
                  <span key={j} aria-label="cycle break pending" className="inline-block w-[1ch] border-b-2 border-accent">
                      &nbsp;
                    </span> :

                  <span key={j} aria-hidden className="text-ink-3">
                      ·
                    </span>;

                }
                const isBreak = breakAt === idx && resolved;
                return (
                  <span key={j} className={`relative ${j > 0 && displayTokens.some((t) => t.length > 1) ? 'ml-[0.35em]' : ''}`}>
                    {isBreak &&
                    <>
                        <span aria-hidden className="absolute -left-[0.2em] top-[-12%] h-[124%] w-px bg-accent" />
                        <span className="sr-only">cycle break at </span>
                      </>
                    }
                    {letter}
                  </span>);

              })}
            </span>
            {!hideWords &&
            <span className={`mt-1.5 ${nowrap ? '' : 'max-w-[11rem] truncate'} leading-snug text-ink-2 ${WORD_SIZE[size]}`}>
                {pending ? '\u00a0' : renderWord ? renderWord(pair, i) : words?.[i] ?? '\u00a0'}
              </span>
            }
          </li>);

      })}
    </ol>);

}
