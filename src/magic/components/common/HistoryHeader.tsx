import React from 'react';
import { XIcon } from 'lucide-react';

/** Quiet row above a history list: what it is, and a Clear that always asks first. */
export function HistoryHeader({ label, count, onClear }: {label: string;count: number;onClear: () => void;}) {
  return (
    <div className="flex h-9 shrink-0 items-center justify-between border-b border-line pl-5 pr-2">
      <span className="text-[11px] text-ink-3">
        {label} <span className="ml-1 font-mono tnum">{count}</span>
      </span>
      <button
        type="button"
        onClick={onClear}
        disabled={count === 0}
        className="inline-flex h-7 items-center gap-2 rounded-[4px] px-2 text-[11.5px] text-ink-3 transition-colors duration-150 ease-out hover:bg-hover hover:text-ink-2 disabled:pointer-events-none disabled:opacity-40">
        
        Clear <span className="hidden font-mono text-[10.5px] lg:inline">⇧⌫</span>
      </button>
    </div>);

}

/** Per-row delete: appears on hover or keyboard focus, never shifts the row. */
export function RowDelete({ label, onClick }: {label: string;onClick: () => void;}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-[4px] text-ink-3 opacity-0 transition-[opacity,background-color,color] duration-150 ease-out hover:bg-hover hover:text-ink focus-visible:opacity-100 group-hover:opacity-100">
      
      <XIcon size={12} strokeWidth={1.75} />
    </button>);

}