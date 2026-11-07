import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Trash2Icon } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Segmented } from '../components/common/Segmented';
import { ShortcutSheet } from '../components/common/ShortcutSheet';
import { SubNavigation } from '../components/layout/SubNavigation';
import { AppBar } from '../components/layout/AppBar';
import { FirstTokenRail } from '../components/pairs/FirstTokenRail';
import { GROUP, PairGroups, PairRow } from '../components/pairs/PairGroups';
import { PairEditor } from '../components/pairs/PairEditor';
import { useAppData } from '../contexts/AppDataContext';
import { useShortcutSheet } from '../hooks/useShortcutSheet';
import { PairScope } from '../types/app';
import { EASE_OUT } from '../utils/keyboard';
import { pairKey, resolveWords, splitKey, tokenize } from '../utils/pairs';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { tokensOf } from '../utils/scheme';
import { useScreenInit } from '../useScreenInit.js';

interface ScreenState {
  scope?: PairScope;
  focus?: [string, string];
  editor?: boolean;
  suggestions?: boolean;
}

/**
 * One first letter at a time: a short, readable list instead of a 576-cell wall.
 * The rail at left is the index; the list is grouped in fours, like the stickers of a face.
 */
export function LetterPairs() {
  const init = useScreenInit() as ScreenState;
  const { pairs, savePair, replacePairs, usage, setup } = useAppData();
  const [confirmSection, setConfirmSection] = useState(false);
  const sheet = useShortcutSheet();
  const [scope, setScope] = useState<PairScope>(init.scope ?? 'shared');
  const axes = useMemo(
    () => tokensOf(setup.scheme, scope === 'edges' ? 'edge' : scope === 'corners' ? 'corner' : undefined),
    [setup.scheme, scope]
  );

  const [first, setFirst] = useState<string>(() => init.focus && axes.includes(init.focus[0]) ? init.focus[0] : axes[19] ?? axes[0]);
  const [focus, setFocus] = useState<number>(() => {
    const i = init.focus ? axes.indexOf(init.focus[1]) : 22;
    return i >= 0 ? i : 0;
  });
  const [editing, setEditing] = useState<string | null>(init.editor && init.focus ? init.focus[1] : null);
  const [refocus, setRefocus] = useState(init.editor ? 0 : 1);
  const typed = useRef<{buf: string;timer?: number;}>({ buf: '' });

  const activeFirst = axes.includes(first) ? first : axes[0];
  const total = axes.length - 1;

  const rowFor = useCallback(
    (a: string, b: string): PairRow => {
      const key = pairKey(a, b);
      const entry = pairs[key];
      const r = resolveWords(entry, scope);
      let override: PairRow['override'] = null;
      if (scope === 'shared' && entry) {
        if (entry.corners?.length) override = { label: 'corners', word: entry.corners[0] };else
        if (entry.edges?.length) override = { label: 'edges', word: entry.edges[0] };
      } else if (scope !== 'shared' && r.source === 'override') {
        override = { label: scope === 'edges' ? 'edges only' : 'corners only', word: r.words[0] };
      }
      return {
        second: b,
        words: r.words,
        override,
        inherited: scope !== 'shared' && r.source === 'shared',
        impossible: a === b,
        uses: usage[key] ?? 0
      };
    },
    [pairs, scope, usage]
  );

  const rows = useMemo(() => axes.map((b) => rowFor(activeFirst, b)), [axes, activeFirst, rowFor]);

  const filled = useMemo(() => {
    const out: Record<string, number> = {};
    axes.forEach((a) => {
      out[a] = axes.filter((b) => a !== b && resolveWords(pairs[pairKey(a, b)], scope).words.length > 0).length;
    });
    return out;
  }, [axes, pairs, scope]);
  const allEmpty = Object.values(filled).every((n) => n === 0);

  // Every saved entry starting with this token, in any scope (shared, edge or corner override).
  const sectionKeys = useMemo(() => Object.keys(pairs).filter((k) => splitKey(k)[0] === activeFirst), [pairs, activeFirst]);
  const clearSection = () => {
    const drop = new Set(sectionKeys);
    replacePairs((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => !drop.has(k))));
    setConfirmSection(false);
    setRefocus((n) => n + 1);
  };

  const selectFirst = (t: string) => {
    setFirst(t);
    setRefocus((n) => n + 1);
  };

  const shiftFirst = (d: number) => {
    const i = axes.indexOf(activeFirst);
    selectFirst(axes[(i + d + axes.length) % axes.length]);
  };

  const open = (i: number) => {
    if (rows[i]?.impossible) return;
    setFocus(i);
    setEditing(axes[i]);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const last = rows.length - 1;
    const move = (i: number) => {
      e.preventDefault();
      setFocus(Math.max(0, Math.min(last, i)));
    };
    switch (e.key) {
      case 'ArrowDown':
        return move(focus + 1);
      case 'ArrowUp':
        return move(focus - 1);
      case 'ArrowRight':
        return move(focus + GROUP <= last ? focus + GROUP : focus);
      case 'ArrowLeft':
        return move(focus - GROUP >= 0 ? focus - GROUP : focus);
      case 'Home':
        return move(0);
      case 'End':
        return move(last);
      case '[':
      case 'PageUp':
        e.preventDefault();
        return shiftFirst(-1);
      case ']':
      case 'PageDown':
        e.preventDefault();
        return shiftFirst(1);
      case 'Enter':
        e.preventDefault();
        return open(focus);
    }
    if (e.key.length === 1 && /[a-z0-9]/i.test(e.key)) {
      e.preventDefault();
      const t = typed.current;
      window.clearTimeout(t.timer);
      t.buf += e.key.toUpperCase();
      const parts = tokenize(t.buf, axes);
      const valid = parts.every((p) => axes.includes(p));
      if (valid && parts.length >= 2) {
        setFirst(parts[0]);
        setFocus(axes.indexOf(parts[1]));
        setRefocus((n) => n + 1);
        t.buf = '';
      } else if (valid && parts.length === 1) {
        setFirst(parts[0]);
        t.timer = window.setTimeout(() => t.buf = '', 900);
      } else {
        t.buf = '';
      }
    }
  };

  const closeEditor = () => {
    setEditing(null);
    setRefocus((n) => n + 1);
  };

  const scopeOptions = [
  { value: 'shared' as PairScope, label: 'Shared' },
  { value: 'edges' as PairScope, label: 'Edges' },
  { value: 'corners' as PairScope, label: 'Corners' }];


  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-bg font-sans text-ink">
      <AppBar onShortcuts={sheet.openSheet} />

      <SubNavigation label="Letter Pairs navigation" title="Letter Pairs" trigger={<span>First letter <span className="ml-2 font-mono text-ink-2">{activeFirst}</span></span>}>
        {(close)=><FirstTokenRail tokens={axes} active={activeFirst} filled={filled} total={total} onSelect={(token)=>{selectFirst(token);close();}} />}
      </SubNavigation>
      <div className="flex min-h-0 flex-1 flex-col">
        <main className="flex min-h-0 min-w-0 flex-col">
          <header className="flex shrink-0 flex-wrap items-end justify-between gap-4 px-5 pb-[clamp(12px,3vh,24px)] pt-[clamp(14px,3.5vh,32px)] md:px-10">
            <div className="flex items-baseline gap-4">
              <AnimatePresence mode="wait" initial={false}>
                <motion.h1
                  key={activeFirst}
                  initial={{ opacity: 0, y: 3 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.12, ease: EASE_OUT }}
                  className="font-timer text-[clamp(36px,6vh,56px)] font-extralight leading-none tracking-[0.02em] text-ink">

                  <span className="sr-only">Pairs starting with </span>
                  {activeFirst}
                </motion.h1>
              </AnimatePresence>
              <span className="font-mono text-[12px] text-ink-3 tnum">
                {filled[activeFirst] ?? 0} / {total}
              </span>
              {allEmpty && <span className="text-[12.5px] text-ink-3">No words yet</span>}
            </div>
            <div className="flex items-center gap-4">
              <Segmented label="Vocabulary" size="sm" options={scopeOptions} value={scope} onChange={setScope} />
              {sectionKeys.length > 0 &&
              <>
                  <span aria-hidden className="h-5 w-px bg-line-strong" />
                  <button
                  type="button"
                  onClick={() => setConfirmSection(true)}
                  className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-[4px] px-2 text-[12.5px] text-danger transition-colors duration-150 ease-out hover:bg-danger-soft">

                    <Trash2Icon size={13} strokeWidth={1.75} aria-hidden />
                    Clear {activeFirst} pairs
                  </button>
                </>
              }
            </div>
          </header>

          <div className="scroll-quiet min-h-0 flex-1 overflow-y-auto px-5 pb-10 md:px-10">
            <PairGroups
              first={activeFirst}
              rows={rows}
              focus={Math.min(focus, rows.length - 1)}
              onFocus={setFocus}
              onOpen={open}
              onKeyDown={onKeyDown}
              refocus={refocus} />
            
          </div>
        </main>
      </div>

      <AnimatePresence>
        {editing && editing !== activeFirst &&
        <PairEditor
          key={`${activeFirst}|${editing}`}
          first={activeFirst}
          second={editing}
          entry={pairs[pairKey(activeFirst, editing)]}
          initialScope={scope}
          uses={usage[pairKey(activeFirst, editing)] ?? 0}
          suggestionsOpen={!!init.suggestions}
          onClose={closeEditor}
          onSave={(entry) => {
            savePair(pairKey(activeFirst, editing), entry);
            closeEditor();
          }} />

        }
      </AnimatePresence>
      <ConfirmDialog
        open={confirmSection}
        title={`Clear ${activeFirst} pairs?`}
        body={`This will remove saved words from ${sectionKeys.length} ${sectionKeys.length === 1 ? 'pair' : 'pairs'} starting with ${activeFirst}, including alternates and overrides. This can’t be undone.`}
        onCancel={() => setConfirmSection(false)}
        confirm={{ label: 'Clear pairs', onClick: clearSection, tone: 'danger' }} />

      <ShortcutSheet open={sheet.open} onClose={sheet.closeSheet} page="pairs" />
    </div>);

}
