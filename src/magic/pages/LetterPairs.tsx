import React, { useCallback, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Segmented } from '../components/common/Segmented';
import { ShortcutSheet } from '../components/common/ShortcutSheet';
import { AppBar } from '../components/layout/AppBar';
import { FirstTokenRail } from '../components/pairs/FirstTokenRail';
import { GROUP, PairGroups, PairRow } from '../components/pairs/PairGroups';
import { PairEditor } from '../components/pairs/PairEditor';
import { useAppData } from '../contexts/AppDataContext';
import { useShortcutSheet } from '../hooks/useShortcutSheet';
import { PairScope } from '../types/app';
import { EASE_OUT } from '../utils/keyboard';
import { pairKey, resolveWords, tokenize } from '../utils/pairs';
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
  const { pairs, savePair, usage, prefs, setup } = useAppData();
  const sheet = useShortcutSheet();
  const sharing = prefs.sharing;
  const [scope, setScope] = useState<PairScope>(init.scope ?? (sharing === 'shared' ? 'shared' : 'edges'));
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
      const r = resolveWords(entry, scope, sharing);
      let override: PairRow['override'] = null;
      if (scope === 'shared' && entry) {
        if (entry.corners?.length) override = { label: 'corners', word: entry.corners[0] };else
        if (entry.edges?.length) override = { label: 'edges', word: entry.edges[0] };
      } else if (scope !== 'shared' && r.source === 'override' && sharing === 'shared') {
        override = { label: scope === 'edges' ? 'edges only' : 'corners only', word: r.words[0] };
      }
      return {
        second: b,
        words: r.words,
        override,
        inherited: scope !== 'shared' && sharing === 'shared' && r.source === 'shared',
        impossible: a === b,
        uses: usage[key] ?? 0
      };
    },
    [pairs, scope, sharing, usage]
  );

  const rows = useMemo(() => axes.map((b) => rowFor(activeFirst, b)), [axes, activeFirst, rowFor]);

  const filled = useMemo(() => {
    const out: Record<string, number> = {};
    axes.forEach((a) => {
      out[a] = axes.filter((b) => a !== b && resolveWords(pairs[pairKey(a, b)], scope, sharing).words.length > 0).length;
    });
    return out;
  }, [axes, pairs, scope, sharing]);
  const allEmpty = Object.values(filled).every((n) => n === 0);

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

  const scopeOptions =
  sharing === 'shared' ?
  [
  { value: 'shared' as PairScope, label: 'Shared' },
  { value: 'edges' as PairScope, label: 'Edges' },
  { value: 'corners' as PairScope, label: 'Corners' }] :

  [
  { value: 'edges' as PairScope, label: 'Edges' },
  { value: 'corners' as PairScope, label: 'Corners' }];


  return (
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-bg font-sans text-ink">
      <AppBar onShortcuts={sheet.openSheet} />

      <div className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] md:grid-cols-[104px_minmax(0,1fr)] md:grid-rows-[minmax(0,1fr)]">
        <div className="min-h-0 min-w-0 overflow-hidden border-b border-line md:h-full md:border-b-0">
          <FirstTokenRail tokens={axes} active={activeFirst} filled={filled} total={total} onSelect={selectFirst} />
        </div>

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
              {allEmpty && <span className="text-[12.5px] text-ink-3">No mnemonics yet</span>}
            </div>
            <Segmented label="Vocabulary" size="sm" options={scopeOptions} value={scope} onChange={setScope} />
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
          sharing={sharing}
          uses={usage[pairKey(activeFirst, editing)] ?? 0}
          suggestionsOpen={!!init.suggestions}
          onClose={closeEditor}
          onSave={(entry) => {
            savePair(pairKey(activeFirst, editing), entry);
            closeEditor();
          }} />

        }
      </AnimatePresence>
      <ShortcutSheet open={sheet.open} onClose={sheet.closeSheet} page="pairs" />
    </div>);

}