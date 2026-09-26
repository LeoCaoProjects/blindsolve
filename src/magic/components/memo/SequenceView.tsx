import React from 'react';
import { chunkPairs } from '../../utils/pairs';

export type TokenMark = 'ok' | 'wrong' | 'missing' | 'extra';

interface SequenceViewProps {
  tokens: string[];
  marks?: TokenMark[];
  size?: 'xl' | 'lg' | 'md';
  tone?: 'ink' | 'muted';
  className?: string;
}

const SIZE = {
  xl: 'text-[40px] md:text-[56px] gap-x-[0.8em] gap-y-[0.25em]',
  lg: 'text-[30px] md:text-[36px] gap-x-[0.8em] gap-y-[0.2em]',
  md: 'text-[20px] gap-x-[0.9em] gap-y-[0.2em]'
};

/**
 * Memo set as pairs: tight inside a pair, generous between pairs.
 * Multi-character tokens get a hairline gap so boundaries are never ambiguous.
 */
export function SequenceView({ tokens, marks, size = 'xl', tone = 'ink', className = '' }: SequenceViewProps) {
  const pairs = chunkPairs(tokens.map((t, i) => ({ t, i })));
  return (
    <ol
      aria-label={tokens.join(' ')}
      className={`flex flex-wrap font-timer font-light leading-[1.1] ${SIZE[size]} ${tone === 'ink' ? 'text-ink' : 'text-ink-2'} ${className}`}>
      
      {pairs.map((pair, pi) => {
        const multi = pair.some((p) => p.t.length > 1);
        return (
          <li key={pi} aria-hidden className={`flex items-baseline tracking-[0.06em] ${multi ? 'gap-[0.28em]' : ''}`}>
            {pair.map(({ t, i }) => {
              const m = marks?.[i];
              return (
                <span
                  key={i}
                  className={
                  m === 'wrong' || m === 'extra' ?
                  'text-accent underline decoration-accent decoration-1 underline-offset-[0.18em]' :
                  m === 'missing' ?
                  'text-ink-3' :
                  m === 'ok' ?
                  'text-ink-2' :
                  ''
                  }>
                  
                  {t}
                </span>);

            })}
          </li>);

      })}
    </ol>);

}