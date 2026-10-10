import React, { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { XIcon } from 'lucide-react';
import { PairEntry, PairScope } from '../../types/app';
import { EASE_OUT } from '../../utils/keyboard';
import { normalizeWords } from '../../utils/pairs';
import { IconButton } from '../common/IconButton';
import { Inspector } from '../common/Inspector';
import { PrimaryButton, QuietButton } from '../common/PrimaryButton';
import { Segmented } from '../common/Segmented';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { SuggestToggle, SuggestionList } from '../common/SuggestWords';
import { PairTokens } from './PairTokens';

interface PairEditorProps {
  first: string;
  second: string;
  entry: PairEntry | undefined;
  initialScope: PairScope;
  uses: number;
  suggestionsOpen?: boolean;
  onSave: (entry: PairEntry | null) => void;
  onClose: () => void;
}

export function PairEditor({ first, second, entry, initialScope, uses, suggestionsOpen = false, onSave, onClose }: PairEditorProps) {
  const [draft, setDraft] = useState<PairEntry>(() => entry ?? { shared: [] });
  const [tab, setTab] = useState<PairScope>(initialScope);
  const [showSuggestions, setShowSuggestions] = useState(suggestionsOpen);
  const [alt, setAlt] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const primaryRef = useRef<HTMLInputElement>(null);
  const savedCount = entry ? entry.shared.length + (entry.edges?.length ?? 0) + (entry.corners?.length ?? 0) : 0;

  const inheriting = tab !== 'shared' && draft[tab] === undefined;
  const words = tab === 'shared' ? draft.shared : draft[tab] ?? [];
  const primary = words[0] ?? '';
  const alternates = words.slice(1);

  const setWords = (next: string[]) =>
  setDraft((d) => tab === 'shared' ? { ...d, shared: next } : { ...d, [tab]: next });

  // Removing the primary promotes the first alternate, and says so. Any alternate can still be
  // made primary by clicking it. Nothing is written until Save.
  const removePrimary = () => {
    setWords(alternates);
    setNote(alternates[0] ? `${alternates[0]} is now the primary. Click another alternate to swap.` : null);
    primaryRef.current?.focus();
  };

  const startOverride = () => {
    setDraft((d) => ({ ...d, [tab]: [] }));
    requestAnimationFrame(() => primaryRef.current?.focus());
  };

  const removeOverride = () =>
  setDraft((d) => {
    const next = { ...d };
    delete next[tab as 'edges' | 'corners'];
    return next;
  });

  const addAlternate = () => {
    const w = alt.trim();
    if (!w) return;
    setWords(primary ? [primary, ...alternates, w] : [w, ...alternates]);
    setAlt('');
  };

  const save = () => {
    const out: PairEntry = { shared: normalizeWords(draft.shared) };
    (['edges', 'corners'] as const).forEach((k) => {
      if (draft[k] === undefined) return;
      const w = normalizeWords(draft[k] ?? []);
      if (w.length) out[k] = w;
    });
    const empty = !out.shared.length && !out.edges?.length && !out.corners?.length;
    onSave(empty ? null : out);
  };

  const scopeOptions = [
  { value: 'shared' as PairScope, label: 'Shared' },
  { value: 'edges' as PairScope, label: 'Edges', marked: !!draft.edges?.length },
  { value: 'corners' as PairScope, label: 'Corners', marked: !!draft.corners?.length }];


  return (
    <Inspector label={`Pair ${first}${second}`} onClose={onClose} width={480}>
      <header className="relative shrink-0 border-b border-line bg-surface px-6 pb-[clamp(14px,3vh,24px)] pt-[clamp(16px,3.5vh,28px)] md:px-8">
        <IconButton label="Close" onClick={onClose} className="absolute right-3 top-3">
          <XIcon />
        </IconButton>
        <PairTokens first={first} second={second} className="block font-timer text-[clamp(40px,8vh,64px)] font-extralight leading-none tracking-[0.04em] text-ink" />
        <p className="mt-4 text-[12.5px] text-ink-3">{uses > 0 ? `Used in ${uses} solves` : 'Not used in a solve yet'}</p>
      </header>

      <div className="scroll-quiet min-h-0 flex-1 overflow-y-auto px-6 pb-8 pt-6 md:px-8">
        <Segmented label="Applies to" options={scopeOptions} value={tab} onChange={setTab} />

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={tab + (inheriting ? '-i' : '')}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.14, ease: EASE_OUT }}
            className="mt-7">
            
            {inheriting ?
            <div>
                <p className="text-[12.5px] text-ink-3">Uses shared</p>
                <p className={`mt-1.5 text-[22px] ${draft.shared[0] ? 'text-ink-2' : 'text-ink-3'}`}>{draft.shared[0] ?? 'Nothing yet'}</p>
                <button
                type="button"
                onClick={startOverride}
                className="mt-5 inline-flex h-8 items-center rounded-[4px] border border-line-strong px-3 text-[12.5px] text-ink transition-colors duration-150 ease-out hover:bg-hover">
                
                  Different word for {tab}
                </button>
              </div> :

            <div>
                <input
                ref={primaryRef}
                autoFocus
                aria-label="Mnemonic"
                value={primary}
                placeholder="Add mnemonic"
                onChange={(e) => {
                  setNote(null);
                  setWords([e.target.value, ...alternates]);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    save();
                  }
                }}
                className="w-full border-b border-line-strong bg-transparent pb-2 text-[26px] text-ink outline-none transition-colors duration-150 ease-out placeholder:text-ink-3 focus:border-accent" />
              
                <div className="mt-2 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-4">
                    {primary.trim() &&
                  <button type="button" onClick={removePrimary} className="text-[12.5px] text-ink-3 transition-colors duration-150 hover:text-ink-2">
                        Remove
                      </button>
                  }
                    {tab !== 'shared' &&
                  <button type="button" onClick={removeOverride} className="text-[12.5px] text-ink-3 transition-colors duration-150 hover:text-ink-2">
                        Use shared instead
                      </button>
                  }
                  </div>
                  <SuggestToggle open={showSuggestions} onToggle={() => setShowSuggestions((v) => !v)} className="-mr-1.5" />
                </div>
                {note &&
              <p role="status" className="mt-2 text-[12.5px] text-ink-2">
                    {note}
                  </p>
              }

                <AnimatePresence initial={false}>
                  {showSuggestions &&
                <SuggestionList
                  className="mt-2"
                  first={first}
                  second={second}
                  exclude={alternates}
                  current={primary}
                  onPick={(w) => {
                    setNote(null);
                    setWords([w, ...alternates]);
                    primaryRef.current?.focus();
                  }} />

                }
                </AnimatePresence>

                <section className="mt-9">
                  <h3 className="text-[12px] text-ink-3">Alternates</h3>
                  <ul className="mt-2">
                    <AnimatePresence initial={false}>
                      {alternates.map((w, i) =>
                    <motion.li
                      key={w + i}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.16, ease: EASE_OUT }}
                      className="group flex items-center justify-between border-b border-line">
                      
                          <button
                        type="button"
                        title="Make primary"
                        onClick={() => {
                          setNote(null);
                          setWords([w, primary, ...alternates.filter((_, j) => j !== i)].filter(Boolean));
                        }}
                        className="min-w-0 flex-1 truncate py-2.5 text-left text-[14px] text-ink-2 transition-colors duration-150 hover:text-ink">
                        
                            {w}
                          </button>
                          <IconButton size="sm" label={`Remove ${w}`} onClick={() => setWords([primary, ...alternates.filter((_, j) => j !== i)])}>
                            <XIcon />
                          </IconButton>
                        </motion.li>
                    )}
                    </AnimatePresence>
                  </ul>
                  <input
                  aria-label="Add alternate"
                  value={alt}
                  placeholder="Add alternate"
                  onChange={(e) => setAlt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addAlternate();
                    }
                  }}
                  onBlur={addAlternate}
                  className="mt-1 w-full border-b border-transparent bg-transparent py-2.5 text-[14px] text-ink outline-none transition-colors duration-150 placeholder:text-ink-3 focus:border-line-strong" />
                
                </section>
              </div>
            }
          </motion.div>
        </AnimatePresence>
      </div>

      <footer className="dock-inset flex shrink-0 items-center justify-between border-t border-line px-6 pt-3.5">
        {savedCount > 0 ?
        <QuietButton onClick={() => setConfirmClear(true)}>Clear pair</QuietButton> :
        !inheriting && words.length > 0 ?
        <QuietButton onClick={() => setWords([])}>Clear</QuietButton> :

        <span />
        }
        <div className="flex items-center gap-2">
          <QuietButton onClick={onClose}>Cancel</QuietButton>
          <PrimaryButton onClick={save}>Save</PrimaryButton>
        </div>
      </footer>
      <ConfirmDialog
        open={confirmClear}
        title={`Clear ${first}${second}?`}
        body={`This removes ${savedCount === 1 ? 'its saved word' : `all ${savedCount} saved words`}, including alternates and edge or corner overrides.`}
        onCancel={() => setConfirmClear(false)}
        confirm={{ label: 'Clear pair', onClick: () => onSave(null), tone: 'danger' }} />

    </Inspector>);

}
