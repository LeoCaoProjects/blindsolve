import React, { useState } from 'react';
import { chunkPairs } from '../../utils/pairs';

interface PairWordsProps {
  tokens: string[];
  wordFor: (first: string, second: string) => string | undefined;
  onAdd: (first: string, second: string, word: string) => void;
}

/** Correct memo as pairs with the user's words beneath; missing words can be filled in place. */
export function PairWords({ tokens, wordFor, onAdd }: PairWordsProps) {
  const pairs = chunkPairs(tokens);
  return (
    <ol className="flex flex-wrap gap-x-7 gap-y-4">
      {pairs.map((pair, i) => {
        const [a, b] = pair;
        const multi = pair.some((t) => t.length > 1);
        return (
          <li key={i} className="flex min-w-[3ch] max-w-[12rem] flex-col">
            <span className={`font-mono text-[17px] leading-none tracking-[0.12em] text-ink ${multi ? 'flex gap-[0.3em]' : ''}`}>
              {pair.map((t, j) =>
              <span key={j}>{t}</span>
              )}
            </span>
            <span className="mt-1.5 text-[12.5px] leading-snug">
              {b === undefined ?
              <span className="text-ink-3">&nbsp;</span> :

              <WordSlot word={wordFor(a, b)} pair={`${a}${b}`} onAdd={(w) => onAdd(a, b, w)} />
              }
            </span>
          </li>);

      })}
    </ol>);

}

export function WordSlot({ word, pair, onAdd }: {word?: string;pair: string;onAdd: (w: string) => void;}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  if (word) return <span className="block truncate text-ink-2">{word}</span>;
  if (editing) {
    const commit = () => {
      if (value.trim()) onAdd(value.trim());
      setEditing(false);
    };
    return (
      <input
        autoFocus
        aria-label={`Mnemonic for ${pair}`}
        value={value}
        size={Math.max(value.length + 1, 9)}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
          }
          if (e.key === 'Escape') {
            e.preventDefault();
            setEditing(false);
          }
        }}
        className="w-full border-b border-accent bg-transparent pb-px text-ink outline-none" />);


  }
  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="border-b border-dashed border-line-strong pb-px text-ink-3 transition-colors duration-150 ease-out hover:border-ink-3 hover:text-ink-2">
      
      No mnemonic
    </button>);

}