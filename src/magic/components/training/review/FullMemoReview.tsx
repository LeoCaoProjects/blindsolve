import React, { useState } from 'react';
import { CheckIcon, XIcon } from 'lucide-react';
import { useAppData } from '../../../contexts/AppDataContext';
import { TrainingSession } from '../../../hooks/useTrainingSession';
import { PairScope } from '../../../types/app';
import { Piece } from '../../../types/solve';
import { pairKey } from '../../../utils/pairs';
import { formatTime } from '../../../utils/time';
import { FullRow } from '../../../utils/training';
import { PairTokens } from '../../pairs/PairTokens';
import { ReviewHeader, ReviewPanel } from './ReviewPanel';
import { ReviewSummary } from './ReviewSummary';

type Decision = 'keep' | 'replace' | 'alternate' | 'save';

/**
 * Full Memo is graded against your list, like Flashcards: a word is correct only if it matches the
 * saved word or one of its alternates. Wrong answers stay wrong; you can still adopt them, but
 * nothing is written until Save.
 */
export function FullMemoReview({ t }: {t: TrainingSession;}) {
  const { pairs, prefs, savePair } = useAppData();
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [applied, setApplied] = useState<Record<string, Decision>>({});
  const [showAll, setShowAll] = useState(false);

  const rows = t.fullRows;
  const graded = rows.filter((r) => r.stored.length > 0);
  const correct = graded.filter((r) => r.status === 'main' || r.status === 'alternate').length;
  const wrong = rows.filter((r) => r.status === 'wrong');
  const missing = rows.filter((r) => r.status === 'missing');
  const fresh = rows.filter((r) => r.status === 'new');
  const attention = [...wrong, ...missing, ...fresh];
  const pendingIds = Object.entries(decisions).filter(([, d]) => d !== 'keep');

  const targetScope = (key: string, piece: Piece): PairScope => {
    const entry = pairs[key];
    if (entry?.[piece]?.length) return piece;
    return prefs.sharing === 'separate' ? piece : 'shared';
  };
  const write = (row: FullRow, words: string[]) => {
    const key = pairKey(row.a, row.b);
    const entry = pairs[key] ?? { shared: [] };
    const scope = targetScope(key, row.piece);
    savePair(key, scope === 'shared' ? { ...entry, shared: words } : { ...entry, [scope]: words });
  };
  const save = () => {
    pendingIds.forEach(([id, d]) => {
      const row = rows.find((r) => r.id === id);
      if (!row) return;
      if (d === 'save') write(row, [row.typed]);
      if (d === 'replace') write(row, [row.typed, ...row.stored.filter((w) => w.toLowerCase() !== row.typed.toLowerCase())]);
      if (d === 'alternate') write(row, [...row.stored, row.typed]);
    });
    setApplied((a) => ({ ...a, ...decisions }));
    setDecisions({});
  };

  const stats: [string, string][] = [];
  if (graded.length) stats.push(['correct', `${correct} / ${graded.length}`]);
  stats.push(['per pair', formatTime(t.elapsed.total / Math.max(1, t.pairCount))]);
  if (fresh.length) stats.push(['new', String(fresh.length)]);

  return (
    <ReviewPanel
      label="Full Memo review"
      onNext={t.next}
      pending={{ count: pendingIds.length, onSave: save, onCancel: () => setDecisions({}) }}
      header={
      <ReviewHeader>
          <ReviewSummary
          time={formatTime(t.elapsed.total)}
          status={wrong.length || missing.length ? 'incorrect' : 'correct'}
          statusLabel={wrong.length || missing.length ? `${wrong.length + missing.length} wrong` : 'All correct'}
          stats={stats} />
        
        </ReviewHeader>
      }>
      
      {attention.length > 0 ?
      <section>
          <h3 className="text-[12px] text-ink-3">To look at</h3>
          <ul className="mt-2">
            {attention.map((row) =>
          <AttentionRow
            key={row.id}
            row={row}
            decision={decisions[row.id] ?? 'keep'}
            applied={applied[row.id]}
            onDecide={(d) => setDecisions((p) => ({ ...p, [row.id]: d }))} />

          )}
          </ul>
        </section> :

      <p className="flex items-center gap-2 text-[14px] text-ink-2">
          <CheckIcon size={14} className="text-ink-3" aria-hidden />
          Every word matches your list
        </p>
      }

      <section className="mt-8 border-t border-line pt-5">
        <button
          type="button"
          aria-expanded={showAll}
          onClick={() => setShowAll((v) => !v)}
          className="-ml-2 inline-flex h-8 items-center rounded-[4px] px-2 text-[12.5px] text-ink-3 transition-colors duration-150 ease-out hover:bg-hover hover:text-ink-2">
          
          {showAll ? 'Hide full memo' : `Show all ${rows.length} pairs`}
        </button>
        {showAll &&
        <ol className="mt-3 grid grid-cols-1 gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((row) => {
            const ok = row.status === 'main' || row.status === 'alternate';
            const bad = row.status === 'wrong' || row.status === 'missing';
            return (
              <li key={row.id} className="grid min-h-[36px] grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3 border-b border-line py-1">
                  <PairTokens first={row.a} second={row.b} className={`font-mono text-[13.5px] tracking-[0.1em] ${ok ? 'text-ink-3' : 'text-ink'}`} />
                  <span className={`truncate text-[13.5px] ${bad ? 'text-accent' : ok ? 'text-ink-3' : 'text-ink'}`}>{row.typed || '·'}</span>
                  <span className="text-[11px] text-ink-3">{row.status === 'alternate' ? 'alt' : row.status === 'new' ? 'new' : ''}</span>
                </li>);

          })}
          </ol>
        }
      </section>
    </ReviewPanel>);

}

const APPLIED_LABEL: Record<Decision, string> = {
  keep: '',
  save: 'saved',
  replace: 'now your main word',
  alternate: 'added as alternate'
};

function AttentionRow({
  row,
  decision,
  applied,
  onDecide





}: {row: FullRow;decision: Decision;applied?: Decision;onDecide: (d: Decision) => void;}) {
  const done = applied && applied !== 'keep';
  return (
    <li className="grid grid-cols-[48px_minmax(0,1fr)] gap-x-4 border-b border-line py-3">
      <PairTokens first={row.a} second={row.b} className="pt-0.5 font-mono text-[15px] tracking-[0.1em] text-ink" />
      <div className="min-w-0">
        {row.status === 'new' ?
        <p className="flex items-baseline gap-2.5">
            <span className="truncate text-[15px] text-ink">{row.typed}</span>
            <span className="text-[12px] text-ink-3">no saved word yet</span>
          </p> :

        <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-3 gap-y-0.5">
            <dt className="text-[11.5px] text-ink-3">typed</dt>
            <dd className="flex min-w-0 items-baseline gap-2">
              {row.status === 'missing' ?
            <span className="text-[14.5px] text-ink-3">nothing entered</span> :

            <>
                  <XIcon size={12} strokeWidth={2} className="shrink-0 self-center text-accent" aria-label="wrong" />
                  <span className="truncate text-[15px] text-accent">{row.typed}</span>
                </>
            }
            </dd>
            <dt className="text-[11.5px] text-ink-3">yours</dt>
            <dd className="truncate text-[14.5px] text-ink">
              {row.stored[0]}
              {row.stored.length > 1 && <span className="ml-2 text-[12px] text-ink-3">or {row.stored.slice(1).join(', ')}</span>}
            </dd>
          </dl>
        }

        {done ?
        <p className="mt-2 text-[12px] text-ink-3">{APPLIED_LABEL[applied!]}</p> :
        row.status === 'wrong' ?
        <Choices
          value={decision}
          onChange={onDecide}
          options={[
          ['keep', `Keep ${row.stored[0]}`],
          ['replace', `Use ${row.typed} instead`],
          ['alternate', 'Add as alternate']]
          } /> :

        row.status === 'new' ?
        <Choices
          value={decision}
          onChange={onDecide}
          options={[
          ['keep', 'Don’t save'],
          ['save', 'Save word']]
          } /> :

        null}
      </div>
    </li>);

}

function Choices({ value, onChange, options }: {value: Decision;onChange: (d: Decision) => void;options: [Decision, string][];}) {
  return (
    <div role="radiogroup" aria-label="What to do with this word" className="mt-2.5 flex flex-wrap gap-1">
      {options.map(([d, label]) => {
        const active = value === d;
        return (
          <button
            key={d}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(d)}
            className={`inline-flex h-8 max-w-[14rem] items-center gap-2 truncate rounded-[4px] border px-2.5 text-[12.5px] transition-colors duration-150 ease-out ${
            active ? 'border-line-strong bg-selected text-ink' : 'border-transparent text-ink-3 hover:bg-hover hover:text-ink-2'}`
            }>
            
            <span aria-hidden className={`h-[5px] w-[5px] shrink-0 rounded-full ${active ? 'bg-ink' : 'bg-line-strong'}`} />
            {label}
          </button>);

      })}
    </div>);

}