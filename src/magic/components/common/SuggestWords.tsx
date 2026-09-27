import React, { useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { SparklesIcon } from 'lucide-react';
import { EASE_OUT } from '../../utils/keyboard';
import { suggestionsFor } from '../../utils/suggestions';
import { Popover, onMenuKeyDown } from './Popover';

/**
 * One suggestion pattern everywhere. Compact places (reconstruction, Memo Recall and Full Memo
 * reviews) use a small "Suggest" control that opens a floating list. The Letter Pairs editor has
 * room for the inline version. Picking a word only fills the field; saving is always separate.
 */

const BATCH = 5;
const MENU_BATCH = 4;

export function SuggestToggle({
  open,
  onToggle,
  label = 'Suggest words',
  className = ''





}: {open: boolean;onToggle: () => void;label?: string;className?: string;}) {
  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={onToggle}
      className={`inline-flex h-7 shrink-0 items-center gap-1.5 rounded-[4px] px-1.5 text-[12.5px] transition-colors duration-150 ease-out hover:bg-hover ${
      open ? 'text-ink-2' : 'text-ink-3 hover:text-ink-2'} ${
      className}`}>
      
      <SparklesIcon size={12} strokeWidth={1.75} aria-hidden />
      {open ? 'Hide suggestions' : label}
    </button>);

}

/** Inline row of suggestions (Letter Pairs editor). */
export function SuggestionList({
  first,
  second,
  onPick,
  exclude,
  current,
  className = ''







}: {first: string;second: string;onPick: (word: string) => void;exclude?: string[];current?: string;className?: string;}) {
  const all = useMemo(() => suggestionsFor(first, second, exclude), [first, second, exclude]);
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(all.length / BATCH));
  const visible = all.slice(page * BATCH, page * BATCH + BATCH);

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.18, ease: EASE_OUT }}
      className={`overflow-hidden ${className}`}>
      
      {all.length === 0 ?
      <p className="pt-2 text-[12.5px] text-ink-3">No suggestions for this pair yet.</p> :

      <div className="flex flex-wrap items-center gap-1.5 pt-2" role="list" aria-label={`Suggestions for ${first}${second}`}>
          <AnimatePresence mode="popLayout" initial={false}>
            {visible.map((w, i) => {
            const active = current?.trim().toLowerCase() === w.toLowerCase();
            return (
              <motion.button
                key={`${page}-${w}`}
                role="listitem"
                type="button"
                onClick={() => onPick(w)}
                initial={{ opacity: 0, y: 3 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.14, ease: EASE_OUT, delay: i * 0.03 }}
                className={`inline-flex h-7 max-w-[14rem] items-center truncate rounded-[4px] border px-2.5 text-[12.5px] transition-colors duration-150 ease-out ${
                active ? 'border-line-strong bg-selected text-ink' : 'border-line text-ink-2 hover:bg-hover hover:text-ink'}`
                }>
                
                  {w}
                </motion.button>);

          })}
          </AnimatePresence>
          {pages > 1 &&
        <button
          type="button"
          onClick={() => setPage((p) => (p + 1) % pages)}
          className="inline-flex h-7 items-center rounded-[4px] px-2 text-[12.5px] text-ink-3 transition-colors duration-150 ease-out hover:bg-hover hover:text-ink-2">
          
              {page + 1 < pages ? 'More' : 'Back to first'}
            </button>
        }
        </div>
      }
    </motion.div>);

}

/** Vertical list for use inside a popover: a few words, then More. */
export function SuggestionMenu({
  first,
  second,
  onPick,
  exclude,
  current






}: {first: string;second: string;onPick: (word: string) => void;exclude?: string[];current?: string;}) {
  const all = useMemo(() => suggestionsFor(first, second, exclude), [first, second, exclude]);
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(all.length / MENU_BATCH));
  const visible = all.slice(page * MENU_BATCH, page * MENU_BATCH + MENU_BATCH);

  return (
    <div onKeyDown={onMenuKeyDown}>
      <p className="px-2 pb-1 pt-1.5 text-[11px] text-ink-3">
        Suggestions for <span className="font-mono tracking-[0.08em] text-ink-2">{first}{second}</span>
      </p>
      {all.length === 0 ?
      <p className="px-2 pb-2 pt-1 text-[12.5px] text-ink-3">None for this pair yet.</p> :

      <ul role="list">
          {visible.map((w, i) => {
          const active = current?.trim().toLowerCase() === w.toLowerCase();
          return (
            <li key={`${page}-${w}`}>
                <button
                type="button"
                autoFocus={i === 0}
                onClick={() => onPick(w)}
                className={`flex h-8 w-full items-center truncate rounded-[4px] px-2 text-left text-[13px] outline-none transition-colors duration-150 ease-out focus-visible:bg-hover ${
                active ? 'bg-selected text-ink' : 'text-ink-2 hover:bg-hover hover:text-ink'}`
                }>
                
                  {w}
                </button>
              </li>);

        })}
        </ul>
      }
      {pages > 1 &&
      <div className="mt-1 border-t border-line pt-1">
          <button
          type="button"
          onClick={() => setPage((p) => (p + 1) % pages)}
          className="flex h-7 w-full items-center rounded-[4px] px-2 text-left text-[12px] text-ink-3 outline-none transition-colors duration-150 ease-out hover:bg-hover hover:text-ink-2 focus-visible:bg-hover">
          
            {page + 1 < pages ? 'More' : 'Back to first'}
          </button>
        </div>
      }
    </div>);

}

/** Small "Suggest" control with a floating list. Never changes the size of the row it sits in. */
export function SuggestPopover({
  first,
  second,
  onPick,
  exclude,
  current,
  label = 'Suggest',
  className = ''








}: {first: string;second: string;onPick: (word: string) => void;exclude?: string[];current?: string;label?: string;className?: string;}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button
        ref={ref}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex h-6 shrink-0 items-center gap-1 rounded-[3px] px-1 text-[11.5px] transition-colors duration-150 ease-out hover:bg-hover ${
        open ? 'text-ink-2' : 'text-ink-3 hover:text-ink-2'} ${
        className}`}>
        
        <SparklesIcon size={11} strokeWidth={1.75} aria-hidden />
        {label}
      </button>
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={ref} label={`Suggestions for ${first}${second}`}>
        <SuggestionMenu
          first={first}
          second={second}
          exclude={exclude}
          current={current}
          onPick={(w) => {
            onPick(w);
            setOpen(false);
          }} />
        
      </Popover>
    </>);

}

/** Toggle and inline list together, for places with room for both on their own line. */
export function SuggestWords({
  first,
  second,
  onPick,
  exclude,
  current,
  defaultOpen = false,
  label,
  className = ''









}: {first: string;second: string;onPick: (word: string) => void;exclude?: string[];current?: string;defaultOpen?: boolean;label?: string;className?: string;}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={className}>
      <SuggestToggle open={open} onToggle={() => setOpen((v) => !v)} label={label} className="-ml-1.5" />
      <AnimatePresence initial={false}>
        {open && <SuggestionList first={first} second={second} onPick={onPick} exclude={exclude} current={current} />}
      </AnimatePresence>
    </div>);

}