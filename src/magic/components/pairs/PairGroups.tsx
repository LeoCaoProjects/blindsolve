import React, { useEffect, useRef } from 'react';
import { PairTokens } from './PairTokens';

export interface PairRow {
  second: string;
  words: string[];
  /** Word differs for edges or corners */
  override: {label: string;word: string;} | null;
  /** Shown in a type view when the word comes from shared vocabulary */
  inherited: boolean;
  impossible: boolean;
  uses: number;
}

interface PairGroupsProps {
  first: string;
  rows: PairRow[];
  focus: number;
  onFocus: (i: number) => void;
  onOpen: (i: number) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  refocus: number;
}

export const GROUP = 4;

/**
 * Pairs for one first letter, in sticker groups of four (one cube face in Speffz).
 * A roving tabindex keeps the whole list a single Tab stop.
 */
export function PairGroups({ first, rows, focus, onFocus, onOpen, onKeyDown, refocus }: PairGroupsProps) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const groups: PairRow[][] = [];
  for (let i = 0; i < rows.length; i += GROUP) groups.push(rows.slice(i, i + GROUP));

  useEffect(() => {
    const active = document.activeElement;
    if (active instanceof HTMLElement && active.closest('[role="dialog"]')) return;
    if (refocus > 0 || active && active.closest('[data-pair-grid]')) refs.current[focus]?.focus({ preventScroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, first, refocus]);

  return (
    <div
      data-pair-grid
      role="grid"
      aria-label={`Pairs starting ${first}`}
      onKeyDown={onKeyDown}
      className="grid grid-cols-1 gap-x-10 gap-y-8 sm:grid-cols-2 xl:grid-cols-3">
      
      {groups.map((g, gi) =>
      <div key={gi} role="rowgroup">
          {g.map((row, ri) => {
          const i = gi * GROUP + ri;
          const focused = i === focus;
          const filled = row.words.length > 0;
          return (
            <div role="row" key={row.second}>
                <button
                ref={(el) => { refs.current[i] = el; }}
                type="button"
                role="gridcell"
                tabIndex={focused ? 0 : -1}
                aria-disabled={row.impossible || undefined}
                aria-label={
                row.impossible ?
                `${first}${row.second}, not a pair` :
                `${first}${row.second}${filled ? `, ${row.words[0]}` : ', empty'}${row.override ? `, ${row.override.label} ${row.override.word}` : ''}`
                }
                onFocus={() => onFocus(i)}
                onClick={() => row.impossible ? onFocus(i) : onOpen(i)}
                className={`group relative grid h-10 w-full grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3 border-b border-line pl-3 pr-2 text-left outline-none transition-colors duration-100 ease-out ${
                focused ? 'bg-selected' : row.impossible ? '' : 'hover:bg-hover'} ${
                row.impossible ? 'cursor-default' : ''}`}>
                
                  {focused && <span aria-hidden className="absolute inset-y-0 left-0 w-px bg-accent" />}
                  <PairTokens
                  first={first}
                  second={row.second}
                  className={`font-mono text-[13.5px] tracking-[0.1em] ${
                  row.impossible ? 'text-ink-3 opacity-40' : filled ? 'text-ink-2' : 'text-ink-3'}`
                  } />
                
                  <span className="flex min-w-0 items-baseline gap-2">
                    {row.impossible ?
                  <span aria-hidden className="text-ink-3 opacity-40">
                        —
                      </span> :

                  <>
                        <span className={`truncate text-[14px] ${row.inherited ? 'text-ink-2' : 'text-ink'}`} title={row.words[0]}>
                          {row.words[0]}
                        </span>
                        {row.words.length > 1 && <span className="shrink-0 font-mono text-[10.5px] text-ink-3">+{row.words.length - 1}</span>}
                      </>
                  }
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    {focused && !row.impossible &&
                  <span className="hidden max-w-[10rem] truncate text-[11.5px] text-ink-3 md:inline">
                        {row.override ? `${row.override.label} · ${row.override.word}` : row.inherited ? 'shared' : ''}
                        {row.uses > 0 && <span className="ml-2 font-mono tnum">{row.uses}×</span>}
                      </span>
                  }
                    {focused && row.impossible && <span className="text-[11.5px] text-ink-3">same sticker</span>}
                    {!focused && row.override &&
                  <span aria-hidden className="h-[5px] w-[5px] border-r border-t border-ink-3" title={`${row.override.label}: ${row.override.word}`} />
                  }
                  </span>
                </button>
              </div>);

        })}
        </div>
      )}
    </div>);

}
