import React, { useState } from 'react';
import { CheckIcon } from 'lucide-react';
import { useAppData } from '../../contexts/AppDataContext';
import { PairScope } from '../../types/app';
import { Piece } from '../../types/solve';
import { pairKey, resolveWords } from '../../utils/pairs';
import { fullPairs, trailingTarget } from '../../utils/training';
import { PairTokens } from '../pairs/PairTokens';

type Resolution = 'saved' | 'kept' | 'used' | 'alternate';

interface FullMemoReviewProps {
  piece: Piece;
  tokens: string[];
  entered: string[];
  showLabel: boolean;
}

/**
 * Target pairs against the words the user produced. Matches stay quiet;
 * only new and changed words ask for a decision — the Timer's reconstruction rules.
 */
export function FullMemoReview({ piece, tokens, entered, showLabel }: FullMemoReviewProps) {
  const { pairs, prefs, savePair } = useAppData();
  const [resolved, setResolved] = useState<Record<string, Resolution>>({});
  const list = fullPairs(tokens);
  const single = trailingTarget(tokens);

  const targetScope = (key: string): PairScope => {
    const entry = pairs[key];
    if (entry?.[piece]?.length) return piece;
    return prefs.sharing === 'separate' ? piece : 'shared';
  };

  const write = (key: string, words: string[]) => {
    const entry = pairs[key] ?? { shared: [] };
    const scope = targetScope(key);
    savePair(key, scope === 'shared' ? { ...entry, shared: words } : { ...entry, [scope]: words });
  };

  const decide = (key: string, r: Resolution, word: string, stored: string[]) => {
    if (r === 'saved') write(key, [word]);
    if (r === 'used') write(key, [word, ...stored.slice(1).filter((w) => w.toLowerCase() !== word.toLowerCase())]);
    if (r === 'alternate') write(key, [...stored, word]);
    setResolved((p) => ({ ...p, [key]: r }));
  };

  return (
    <section className="grid gap-3 md:grid-cols-[72px_minmax(0,1fr)]">
      {showLabel ? <h2 className="pt-2 text-[12px] text-ink-3">{piece === 'corners' ? 'Corners' : 'Edges'}</h2> : <span />}
      <ol className="grid">
        {list.map(([a, b], i) => {
          const key = pairKey(a, b);
          const stored = resolveWords(pairs[key], piece, prefs.sharing).words;
          const word = entered[i]?.trim() ?? '';
          const match = !!word && stored.some((w) => w.toLowerCase() === word.toLowerCase());
          const r = resolved[key];
          const status = !word ? 'missing' : match ? 'ok' : stored.length === 0 ? 'new' : 'changed';
          return (
            <li key={key + i} className="grid min-h-[44px] grid-cols-[48px_minmax(0,1fr)] items-center gap-x-4 border-b border-line py-2 md:grid-cols-[48px_minmax(0,1fr)_auto]">
              <PairTokens first={a} second={b} className="font-mono text-[15px] tracking-[0.1em] text-ink" />
              <div className="min-w-0">
                {status === 'missing' ?
                <span className="text-[14.5px] text-ink-3">
                    —{stored[0] && <span className="ml-3 text-[12.5px]">{stored[0]}</span>}
                  </span> :

                <span className="flex min-w-0 items-baseline gap-3">
                    <span className="truncate text-[15px] text-ink">{word}</span>
                    {status === 'ok' && <CheckIcon size={13} className="shrink-0 self-center text-ink-3" aria-label="matches your word" />}
                    {status === 'new' && !r &&
                  <span className="flex shrink-0 items-center gap-1.5 text-[12px] text-ink-2">
                        <span aria-hidden className="h-[5px] w-[5px] rounded-full bg-accent" />
                        new
                      </span>
                  }
                    {status === 'changed' && !r && <span className="shrink-0 truncate text-[12.5px] text-ink-3">yours: {stored[0]}</span>}
                    {r && <span className="shrink-0 text-[12.5px] text-ink-3">{RESOLVED_LABEL[r](stored[0])}</span>}
                  </span>
                }
              </div>
              {!r && status === 'new' &&
              <div className="col-span-2 flex gap-1 md:col-span-1">
                  <RowAction primary onClick={() => decide(key, 'saved', word, stored)}>
                    Save
                  </RowAction>
                </div>
              }
              {!r && status === 'changed' &&
              <div className="col-span-2 flex flex-wrap gap-1 md:col-span-1">
                  <RowAction onClick={() => decide(key, 'kept', word, stored)}>Keep {stored[0]}</RowAction>
                  <RowAction onClick={() => decide(key, 'used', word, stored)}>Use {word}</RowAction>
                  <RowAction onClick={() => decide(key, 'alternate', word, stored)}>Add alternate</RowAction>
                </div>
              }
            </li>);

        })}
        {single &&
        <li className="grid min-h-[44px] grid-cols-[48px_minmax(0,1fr)] items-center gap-x-4 border-b border-line py-2">
            <span className="font-mono text-[15px] tracking-[0.1em] text-ink">{single}</span>
            <span className="text-[12.5px] text-ink-3">single target</span>
          </li>
        }
      </ol>
    </section>);

}

const RESOLVED_LABEL: Record<Resolution, (old?: string) => string> = {
  saved: () => 'saved',
  kept: (old) => `kept ${old ?? ''}`.trim(),
  used: () => 'now your word',
  alternate: () => 'added as alternate'
};

function RowAction({ children, onClick, primary }: {children: React.ReactNode;onClick: () => void;primary?: boolean;}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-7 max-w-[12rem] items-center truncate rounded-[4px] px-2.5 text-[12.5px] transition-colors duration-150 ease-out ${
      primary ? 'border border-line-strong text-ink hover:bg-hover' : 'text-ink-2 hover:bg-hover hover:text-ink'}`
      }>
      
      {children}
    </button>);

}