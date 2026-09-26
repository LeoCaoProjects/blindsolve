import React from 'react';
import { LetterPairDb, SolveMemo } from '../../types/solve';
import { MemoTrace } from './MemoTrace';

interface SolveMemoViewProps {
  memo: SolveMemo;
  db: LetterPairDb;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  labelWidth?: string;
}

/** The words used in THAT solve — with a quiet note where the database has since moved on. */
export function SolveMemoView({ memo, db, size = 'md', className = '', labelWidth = '72px' }: SolveMemoViewProps) {
  const rows = [
  { label: 'Corners', pairs: memo.corners, breakAt: memo.cornerBreakAt },
  { label: 'Edges', pairs: memo.edges, breakAt: memo.edgeBreakAt }];

  return (
    <div className={`grid gap-7 ${className}`}>
      {rows.map((row) =>
      row.pairs.length ?
      <section key={row.label} className="grid items-start gap-4" style={{ gridTemplateColumns: `${labelWidth} 1fr` }}>
            <h3 className="pt-0.5 text-[12px] text-ink-3">{row.label}</h3>
            <MemoTrace
          size={size}
          pairs={row.pairs.map((p) => p.pair)}
          breakAt={row.breakAt ?? null}
          renderWord={(pair, i) => {
            const used = row.pairs[i].word;
            const current = db[pair]?.[0];
            return (
              <span className="flex flex-col">
                    <span className="truncate">{used || <span className="text-ink-3">—</span>}</span>
                    {current && used && current.toLowerCase() !== used.toLowerCase() &&
                <span className="truncate text-[11px] text-ink-3">now {current}</span>
                }
                  </span>);

          }} />
        
          </section> :
      null
      )}
    </div>);

}