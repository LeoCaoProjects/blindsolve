import React, { useEffect, useRef } from "react";
import { PairTokens } from "./PairTokens";
import type { PairView } from "./PairScopeNavigation";
export interface PairRow {
  second: string;
  words: string[];
  overrides: { piece: "edges" | "corners"; word: string }[];
  impossible: boolean;
}
export const isVisiblePair = (row: PairRow, view: PairView) =>
  !row.impossible && (view === "default" || row.overrides.length > 0);
interface PairGroupsProps {
  first: string;
  view: PairView;
  rows: PairRow[];
  focus: number;
  onFocus: (index: number) => void;
  onOpen: (index: number) => void;
  onKeyDown: (event: React.KeyboardEvent) => void;
  refocus: number;
  jumpRequest?: number;
}
export const pairColumnSize = (count: number) => Math.ceil(count / 2);
/** Default vocabulary, or just its explicit exceptions, in the same reading columns. */
export function PairGroups({
  first,
  view,
  rows,
  focus,
  onFocus,
  onOpen,
  onKeyDown,
  refocus,
  jumpRequest = 0,
}: PairGroupsProps) {
  const lastJump = useRef(jumpRequest);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const entries = rows.flatMap((row, index) =>
    isVisiblePair(row, view) ? [{ row, index }] : [],
  );
  const groups: (typeof entries)[] = [];
  const pairWidth = Math.max(
    44,
    ...rows.map(
      (row) =>
        (first.length + row.second.length) * 8.4 +
        (first.length > 1 || row.second.length > 1 ? 5 : 0),
    ),
  );
  const columnSize = pairColumnSize(entries.length);
  if (columnSize) {
    groups.push(entries.slice(0, columnSize));
    if (entries.length > columnSize) groups.push(entries.slice(columnSize));
  }
  const activeIndex = entries.some((entry) => entry.index === focus)
    ? focus
    : entries[0]?.index;
  useEffect(() => {
    const active = document.activeElement;
    const jumped = lastJump.current !== jumpRequest;
    lastJump.current = jumpRequest;
    if (
      !jumped &&
      active instanceof HTMLElement &&
      active.closest(
        '[role="dialog"], [data-pair-index], [aria-label="Vocabulary"], select',
      )
    )
      return;
    if (
      activeIndex !== undefined &&
      (refocus > 0 || active?.closest("[data-pair-grid]"))
    )
      refs.current[activeIndex]?.focus({ preventScroll: true });
  }, [activeIndex, first, refocus, jumpRequest]);
  if (!entries.length)
    return <p className="px-3 py-3 text-[13px] text-ink-3">No overrides</p>;
  return (
    <div
      data-pair-grid
      role="grid"
      aria-label={`Pairs starting ${first}`}
      onKeyDown={onKeyDown}
      className="grid grid-cols-1 gap-x-12 gap-y-0 md:grid-cols-2"
    >
      {groups.map((group, groupIndex) => (
        <div role="rowgroup" key={groupIndex}>
          {group.map(({ row, index }) => (
            <div role="row" key={row.second}>
              <button
                type="button"
                role="gridcell"
                ref={(el) => {
                  refs.current[index] = el;
                }}
                tabIndex={index === activeIndex ? 0 : -1}
                aria-label={`${first}${row.second}, ${view === "default" ? (row.words[0] ?? "empty") : row.overrides.map((item) => `${item.piece === "edges" ? "Edge" : "Corner"}: ${item.word}`).join(", ")}`}
                onFocus={() => onFocus(index)}
                onClick={() => onOpen(index)}
                style={{ gridTemplateColumns: `${pairWidth}px minmax(0,1fr)` }}
                className="group grid min-h-11 w-full cursor-pointer items-center gap-3 rounded-[4px] px-3 py-2 text-left transition-colors duration-150 hover:bg-hover focus-visible:bg-selected focus-visible:outline-offset-[-2px]"
              >
                <PairTokens
                  first={first}
                  second={row.second}
                  className="font-mono text-[14px] font-medium tracking-[0.03em] text-ink-2 group-hover:text-ink group-focus-visible:text-ink"
                />
                {view === "default" ? (
                  <span className="flex min-w-0 items-baseline gap-2">
                    <span
                      title={row.words[0]}
                      className={`min-w-0 truncate text-[14px] ${row.words.length ? "text-ink" : "text-ink-3"}`}
                    >
                      {row.words[0] ?? "No word"}
                    </span>
                    {row.overrides.length > 0 && (
                      <span className="ml-auto shrink-0 text-[10.5px] italic text-ink-3">
                        {row.overrides.length}{" "}
                        {row.overrides.length === 1 ? "override" : "overrides"}
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="flex min-w-0 flex-col gap-1">
                    {row.overrides.map((item) => (
                      <span
                        key={item.piece}
                        className="flex min-w-0 items-baseline justify-between gap-3"
                      >
                        <span
                          title={item.word}
                          className="truncate text-[14px] text-ink"
                        >
                          {item.word}
                        </span>
                        <span className="shrink-0 text-[10.5px] text-ink-3">
                          {item.piece === "edges" ? "Edge" : "Corner"}
                        </span>
                      </span>
                    ))}
                  </span>
                )}
              </button>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
