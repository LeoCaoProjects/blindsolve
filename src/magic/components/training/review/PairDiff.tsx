import React from 'react';
import { CheckIcon } from 'lucide-react';
import type { TokenMark } from '../../memo/SequenceView';
import { GroupResult } from '../../../utils/training';

/**
 * Expected over yours, one column per pair, aligned by position. Columns wrap, but each column
 * carries both rows so the comparison never drifts. Only differing pairs get a surface.
 */
export function PairDiff({ result, label }: {result: GroupResult;label?: string;}) {
  const cols = Math.ceil(Math.max(result.actual.length, result.typed.length) / 2);
  const cells = Array.from({ length: cols }, (_, c) => {
    const s = c * 2;
    const exp = result.actual.slice(s, s + 2);
    const expM = result.actualMarks.slice(s, s + 2);
    const you = result.typed.slice(s, s + 2);
    const youM = result.typedMarks.slice(s, s + 2);
    const wrong = expM.some((m) => m !== 'ok') || youM.some((m) => m !== 'ok') || you.length !== exp.length;
    return { exp, you, youM, wrong };
  });

  return (
    <section>
      <header className="mb-3 flex items-baseline justify-between gap-4">
        <h3 className="flex items-center gap-2 text-[12px] text-ink-3">
          {label}
          {result.correct && <CheckIcon size={12} className="text-ink-3" aria-label="all correct" />}
        </h3>
        {!result.correct &&
        <span className="text-[11px] text-ink-3">
            expected <span className="mx-1">/</span> <span className="text-ink-2">yours</span>
          </span>
        }
      </header>
      <ol className="grid grid-cols-[repeat(auto-fill,minmax(3.9rem,1fr))] gap-1">
        {cells.map((c, i) =>
        <li
          key={i}
          className={`flex flex-col items-start rounded-[3px] px-2 py-1.5 font-mono text-[16px] leading-[1.35] tracking-[0.08em] ${
          c.wrong ? 'bg-selected' : ''}`
          }>
          
            <Tokens tokens={c.exp} tone={c.wrong ? 'text-ink' : 'text-ink-2'} />
            {!result.correct &&
          <span aria-label={`yours ${c.you.join('') || 'nothing'}`}>
                {c.you.length ? <Tokens tokens={c.you} marks={c.youM} tone={c.wrong ? 'text-ink-2' : 'text-ink-3'} /> : <span className="text-ink-3">··</span>}
              </span>
          }
          </li>
        )}
      </ol>
    </section>);

}

function Tokens({ tokens, marks, tone }: {tokens: string[];marks?: TokenMark[];tone: string;}) {
  const multi = tokens.some((t) => t.length > 1);
  return (
    <span className={`flex ${multi ? 'gap-[0.3em]' : ''} ${tone}`}>
      {tokens.length ?
      tokens.map((t, i) =>
      <span
        key={i}
        className={marks?.[i] === 'wrong' || marks?.[i] === 'extra' ? 'text-accent underline decoration-accent underline-offset-[0.2em]' : ''}>
        
            {t}
          </span>
      ) :

      <span className="text-ink-3">··</span>
      }
    </span>);

}