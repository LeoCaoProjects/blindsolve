import React, { useRef, useState } from 'react';
import { CheckIcon, ChevronDownIcon } from 'lucide-react';
import { Popover, onMenuKeyDown } from '../../common/Popover';
import { SuggestionMenu } from '../../common/SuggestWords';

export interface DecisionOption<T extends string> {
  value: T;
  /** Short text shown on the closed control */
  short: string;
  /** Full text shown in the menu */
  label: string;
}

interface DecisionMenuProps<T extends string> {
  label: string;
  value: T;
  /** The safe default; the control stays quiet while it's selected */
  safe: T;
  options: DecisionOption<T>[];
  onChange: (value: T) => void;
  /** Preserve the workspace theme in the body portal when reused outside review. */
  popoverClassName?: string;
  disabled?: boolean;
  /** Adds "Choose a suggestion…" which swaps the menu for the suggestion list */
  suggest?: {first: string;second: string;current?: string;onPick: (word: string) => void;};
}

/** Compact per-row decision: one quiet control instead of a row of buttons. */
export function DecisionMenu<T extends string>({ label, value, safe, options, onChange, suggest, popoverClassName, disabled }: DecisionMenuProps<T>) {
  const ref = useRef<HTMLButtonElement>(null);
  const [view, setView] = useState<'closed' | 'menu' | 'suggest'>('closed');
  const current = options.find((o) => o.value === value) ?? options[0];
  const changed = value !== safe;
  const close = () => { setView('closed'); ref.current?.focus(); };

  return (
    <>
      <button
        ref={ref}
        type="button"
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={view !== 'closed'}
        aria-label={`${label}: ${current.label}`}
        onClick={() => setView((v) => v === 'closed' ? 'menu' : 'closed')}
        className={`inline-flex h-7 max-w-[9.5rem] shrink-0 items-center gap-1.5 rounded-[4px] border pl-2 pr-1.5 text-[12px] transition-colors duration-150 ease-out ${
        changed ? 'border-line-strong bg-selected text-ink' : 'border-line text-ink-3 hover:border-line-strong hover:text-ink-2'}`
        }>
        
        <span className="truncate">{current.short}</span>
        <ChevronDownIcon size={12} strokeWidth={1.75} className="shrink-0 text-ink-3" aria-hidden />
      </button>
      <Popover className={popoverClassName} open={view !== 'closed'} onClose={close} anchorRef={ref} label={label} width={view === 'suggest' ? 216 : 232}>
        {view === 'suggest' && suggest ?
        <SuggestionMenu
          first={suggest.first}
          second={suggest.second}
          current={suggest.current}
          onPick={(w) => {
            suggest.onPick(w);
            close();
          }} /> :


        <div role="menu" aria-label={label} onKeyDown={onMenuKeyDown}>
            {options.map((o, i) =>
          <button
            key={o.value}
            type="button"
            role="menuitemradio"
            aria-checked={o.value === value}
            autoFocus={o.value === value || i === 0 && !options.some((x) => x.value === value)}
            onClick={() => {
              onChange(o.value);
              close();
            }}
            className="flex h-8 w-full items-center gap-2 rounded-[4px] px-2 text-left text-[13px] text-ink-2 outline-none transition-colors duration-150 ease-out hover:bg-hover hover:text-ink focus-visible:bg-hover">
            
                <span className="flex w-3.5 shrink-0 justify-center">
                  {o.value === value && <CheckIcon size={12} strokeWidth={2} className="text-ink" aria-hidden />}
                </span>
                <span className="truncate">{o.label}</span>
              </button>
          )}
            {suggest &&
          <div className="mt-1 border-t border-line pt-1">
                <button
              type="button"
              role="menuitem"
              onClick={() => setView('suggest')}
              className="flex h-8 w-full items-center gap-2 rounded-[4px] px-2 text-left text-[13px] text-ink-3 outline-none transition-colors duration-150 ease-out hover:bg-hover hover:text-ink-2 focus-visible:bg-hover">
              
                  <span className="w-3.5 shrink-0" />
                  Choose a suggestion…
                </button>
              </div>
          }
          </div>
        }
      </Popover>
    </>);

}
