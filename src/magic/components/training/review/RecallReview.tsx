import React, { useState } from 'react';
import { SuggestPopover } from '../../common/SuggestWords';
import { useAppData } from '../../../contexts/AppDataContext';
import { TrainingSession } from '../../../hooks/useTrainingSession';
import { pairKey } from '../../../utils/pairs';
import { formatTime } from '../../../utils/time';
import { fullPairs } from '../../../utils/training';
import { PairTokens } from '../../pairs/PairTokens';
import { PairDiff } from './PairDiff';
import { ReviewHeader, ReviewPanel } from './ReviewPanel';
import { ReviewSummary } from './ReviewSummary';

const LABEL = { corners: 'Corners', edges: 'Edges' } as const;

export function correctTargets(t: TrainingSession) {
  return t.results.reduce((n, g) => n + g.actual.length - Math.min(g.wrong, g.actual.length), 0);
}

interface WordItem {
  key: string;
  a: string;
  b: string;
  piece: 'corners' | 'edges';
  word?: string;
  missed: boolean;
}

/**
 * Memo Recall: summary, aligned comparison, then only the words worth a look.
 * Missing words can be typed in place; nothing is written until Save.
 */
export function RecallReview({ t }: {t: TrainingSession;}) {
  const { addWord } = useAppData();
  const [showAll, setShowAll] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const ok = correctTargets(t);

  const items: WordItem[] = t.results.flatMap((g) =>
  fullPairs(g.actual).map(([a, b], i) => {
    const typed = g.typed.slice(i * 2, i * 2 + 2);
    return {
      key: `${g.piece}-${i}`,
      a,
      b,
      piece: g.piece,
      word: t.wordFor(a, b, g.piece),
      missed: typed[0] !== a || typed[1] !== b
    };
  })
  );
  const notable = items.filter((w) => !w.word || w.missed || saved.has(w.key));
  const missing = items.filter((w) => !w.word).length;
  const shown = showAll ? items : notable;

  const filled = Object.entries(drafts).filter(([, v]) => v.trim());
  const save = () => {
    const done = new Set(saved);
    filled.forEach(([key, v]) => {
      const item = items.find((w) => w.key === key);
      if (!item) return;
      addWord(pairKey(item.a, item.b), item.piece, v.trim());
      done.add(key);
    });
    setSaved(done);
    setDrafts({});
    setEditing(new Set());
  };
  const cancel = () => {
    setDrafts({});
    setEditing(new Set());
  };

  return (
    <ReviewPanel
      label="Memo Recall review"
      onNext={t.next}
      pending={{ count: filled.length, onSave: save, onCancel: cancel }}
      header={
      <ReviewHeader>
          <ReviewSummary
          status={t.allCorrect ? 'correct' : 'incorrect'}
          stats={[
          ['targets', `${ok} / ${t.targets}`],
          ['memo', formatTime(t.elapsed.memo)],
          ['recall', formatTime(t.elapsed.recall)]]
          } />
        
        </ReviewHeader>
      }>
      
      <div className="grid gap-7">
        {t.results.map((g) =>
        <PairDiff key={g.piece} result={g} label={LABEL[g.piece]} />
        )}
      </div>

      <section className="mt-9 border-t border-line pt-6">
        <header className="flex items-baseline justify-between gap-4">
          <h3 className="text-[12px] text-ink-3">
            {showAll ? 'All words' : notable.length ? 'Worth a look' : 'Every pair has a word'}
            {!showAll && missing > 0 && <span className="ml-3 text-ink-2">{missing} without a word</span>}
          </h3>
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="inline-flex h-8 items-center rounded-[4px] px-2 text-[12.5px] text-ink-3 transition-colors duration-150 ease-out hover:bg-hover hover:text-ink-2">
            
            {showAll ? 'Show fewer' : `Show all words (${items.length})`}
          </button>
        </header>
        {shown.length > 0 &&
        <ul className="mt-3 grid grid-cols-1 items-start gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((w) =>
          <li key={w.key} className="grid min-h-[44px] grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-x-3 border-b border-line py-1.5">
                <PairTokens first={w.a} second={w.b} className={`font-mono text-[14px] tracking-[0.1em] ${w.missed ? 'text-accent' : 'text-ink'}`} />
                <span className="flex min-w-0 items-baseline gap-2 text-[13.5px]">
                  {w.word ?
              <>
                      <span className="truncate text-ink-2">{w.word}</span>
                      {saved.has(w.key) && <span className="shrink-0 text-[11.5px] text-ink-3">saved</span>}
                    </> :
              editing.has(w.key) ?
              <input
                autoFocus
                aria-label={`Word for ${w.a}${w.b}`}
                value={drafts[w.key] ?? ''}
                placeholder="Type a word"
                onChange={(e) => setDrafts((d) => ({ ...d, [w.key]: e.target.value }))}
                className="h-8 w-full min-w-0 rounded-[4px] border border-line-strong bg-surface px-2 text-ink caret-accent outline-none placeholder:text-ink-3 focus:border-ink-3" /> :


              <button
                type="button"
                onClick={() => setEditing((s) => new Set(s).add(w.key))}
                className="border-b border-dashed border-line-strong pb-px text-ink-3 transition-colors duration-150 ease-out hover:border-ink-3 hover:text-ink-2">
                
                      No word · add
                    </button>
              }
                </span>
                {!w.word ?
            <SuggestPopover
              first={w.a}
              second={w.b}
              current={drafts[w.key]}
              onPick={(word) => {
                setDrafts((d) => ({ ...d, [w.key]: word }));
                setEditing((s) => new Set(s).add(w.key));
              }} /> :


            <span />
            }
              </li>
          )}
          </ul>
        }
      </section>
    </ReviewPanel>);

}