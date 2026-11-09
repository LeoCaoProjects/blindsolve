import React, {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useWorkspaceLocation } from "../navigation/workspaces";
import { Trash2Icon } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import {
  PairScopeNavigation,
  type PairView,
} from "../components/pairs/PairScopeNavigation";
import { ShortcutSheet } from "../components/common/ShortcutSheet";
import { SubNavigation } from "../components/layout/SubNavigation";
import { AppBar } from "../components/layout/AppBar";
import { FirstTokenRail } from "../components/pairs/FirstTokenRail";
import {
  GROUP,
  PairGroups,
  PairRow,
  isVisiblePair,
} from "../components/pairs/PairGroups";
import { PairEditor } from "../components/pairs/PairEditor";
import { useAppData } from "../contexts/AppDataContext";
import { useShortcutSheet } from "../hooks/useShortcutSheet";
import { PairScope } from "../types/app";
import { pairKey, resolveWords } from "../utils/pairs";
import { DELETE_BUTTON_STYLE } from "../components/common/destructiveStyle";
import { ConfirmDialog } from "../components/common/ConfirmDialog";
import { isTypingTarget } from "../utils/keyboard";
import { tokensOf } from "../utils/scheme";
import { activePairVocabulary } from "../utils/activePairs";
import { useScreenInit } from "../useScreenInit.js";

interface ScreenState {
  scope?: PairScope;
  focus?: [string, string];
  editor?: boolean;
  suggestions?: boolean;
}

/**
 * One first letter at a time: a short, readable list instead of a 576-cell wall.
 * Scope and the scheme's first-letter index belong to contextual navigation.
 */
export function LetterPairs() {
  const { pathname, key: routeKey } = useWorkspaceLocation();
  const init = useScreenInit() as ScreenState;
  const { pairs, savePair, deletePairGroup, setup } = useAppData();
  const [deletingFirst, setDeletingFirst] = useState<string | null>(null);
  const sheet = useShortcutSheet();
  const [view, setView] = useState<PairView>("default");
  const axesKey = JSON.stringify(tokensOf(setup.scheme));
  // Store hydration may replace scheme objects without changing their tokens.
  // Keep the shortcut listener stable across those unrelated updates.
  const axes = useMemo(() => JSON.parse(axesKey) as string[], [axesKey]);
  const overrideTokens = useMemo(
    () => ({
      edges: tokensOf(setup.scheme, "edge"),
      corners: tokensOf(setup.scheme, "corner"),
    }),
    [setup.scheme],
  );
  const { possible } = useMemo(
    () => activePairVocabulary(setup.scheme),
    [setup.scheme],
  );

  const [first, setFirst] = useState<string>(() =>
    init.focus && axes.includes(init.focus[0]) ? init.focus[0] : axes[0],
  );
  const [focus, setFocus] = useState<number>(() => {
    const i = init.focus ? axes.indexOf(init.focus[1]) : 1;
    return i >= 0 ? i : 0;
  });
  const [editing, setEditing] = useState<string | null>(
    init.editor && init.focus ? init.focus[1] : null,
  );
  const [refocus, setRefocus] = useState(init.editor ? 0 : 1);
  const [jumpRequest, setJumpRequest] = useState(0);
  const typed = useRef<{ buf: string; timer?: number }>({ buf: "" });

  const activeFirst = axes.includes(first) ? first : axes[0];
  const total = axes.filter((second) => possible(activeFirst, second)).length;

  const rowFor = useCallback(
    (a: string, b: string): PairRow => {
      const key = pairKey(a, b);
      const entry = pairs[key];
      return {
        second: b,
        words: resolveWords(entry, "shared").words,
        overrides: (["edges", "corners"] as const).flatMap((piece) =>
          possible(a, b, piece) && entry?.[piece]?.length
            ? [{ piece, word: entry[piece]![0] }]
            : [],
        ),
        impossible: !possible(a, b),
      };
    },
    [pairs, possible],
  );

  const rows = useMemo(
    () => axes.map((b) => rowFor(activeFirst, b)),
    [axes, activeFirst, rowFor],
  );

  const filled = useMemo(() => {
    const out: Record<string, number> = {};
    axes.forEach((a) => {
      out[a] = axes.filter(
        (b) =>
          possible(a, b) &&
          resolveWords(pairs[pairKey(a, b)], "shared").words.length > 0,
      ).length;
    });
    return out;
  }, [axes, pairs, possible]);

  useLayoutEffect(() => {
    if (!axes.includes(first)) setFirst(axes[0]);
    if (editing && !possible(activeFirst, editing)) setEditing(null);
  }, [axes, first, editing, activeFirst, possible]);

  const deleteSelectedPairs = () => {
    if (!deletingFirst) return;
    deletePairGroup(deletingFirst);
    setEditing(null);
    setDeletingFirst(null);
    setRefocus((n) => n + 1);
  };

  const selectFirst = (t: string) => {
    window.clearTimeout(typed.current.timer);
    typed.current.buf = "";
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
    const valid = rows.flatMap((row, index) =>
      isVisiblePair(row, view) ? [index] : [],
    );
    const position = Math.max(0, valid.indexOf(focus));
    const last = valid.length - 1;
    const move = (i: number) => {
      e.preventDefault();
      if (valid.length) setFocus(valid[Math.max(0, Math.min(last, i))]);
    };
    switch (e.key) {
      case "ArrowDown":
        return move(position + 1);
      case "ArrowUp":
        return move(position - 1);
      case "ArrowRight":
        return move(position + GROUP <= last ? position + GROUP : position);
      case "ArrowLeft":
        return move(position - GROUP >= 0 ? position - GROUP : position);
      case "Home":
        return move(0);
      case "End":
        return move(last);
      case "[":
      case "PageUp":
        e.preventDefault();
        return shiftFirst(-1);
      case "]":
      case "PageDown":
        e.preventDefault();
        return shiftFirst(1);
      case "Enter":
        e.preventDefault();
        return open(focus);
    }
  };

  useLayoutEffect(() => {
    const reset = () => {
      window.clearTimeout(typed.current.timer);
      typed.current.buf = "";
    };
    reset();
    if (pathname.replace(/\/$/, "") !== "/pairs") return;
    // Each key selects one single-character label, even when custom labels exist.
    // Multi-character labels remain click/arrow navigable; never parse a raw stream as them.
    const onLetter = (e: KeyboardEvent) => {
      if (
        e.defaultPrevented ||
        e.repeat ||
        e.isComposing ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey ||
        isTypingTarget(e.target) ||
        document.querySelector('[role="dialog"], [role="alertdialog"]')
      ) {
        reset();
        return;
      }
      if (e.key.length === 1 && /[a-z0-9]/i.test(e.key)) {
        e.preventDefault();
        const t = typed.current;
        window.clearTimeout(t.timer);
        t.buf += e.key.toUpperCase();
        const parts = [...t.buf];
        const valid = parts.every((p) => axes.includes(p));
        if (valid && parts.length >= 2) {
          setJumpRequest((n) => n + 1);
          setFirst(parts[0]);
          setFocus(axes.indexOf(parts[1]));
          setRefocus((n) => n + 1);
          t.buf = "";
        } else if (valid && parts.length === 1) {
          setFirst(parts[0]);
          t.timer = window.setTimeout(() => (t.buf = ""), 900);
        } else {
          t.buf = "";
        }
      }
    };
    window.addEventListener("keydown", onLetter);
    const onFocus = (event: FocusEvent) => {
      if (
        isTypingTarget(event.target) ||
        (event.target instanceof HTMLElement &&
          event.target.closest('[role="dialog"], [role="alertdialog"]'))
      )
        reset();
    };
    document.addEventListener("focusin", onFocus);
    window.addEventListener("blur", reset);
    return () => {
      reset();
      window.removeEventListener("keydown", onLetter);
      document.removeEventListener("focusin", onFocus);
      window.removeEventListener("blur", reset);
    };
  }, [axes, view, editing, deletingFirst, sheet.open, pathname, routeKey]);

  const closeEditor = () => {
    setEditing(null);
    setRefocus((n) => n + 1);
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-bg font-sans text-ink">
      <AppBar onShortcuts={sheet.openSheet} />

      <SubNavigation
        label="Letter Pairs navigation"
        title="Letter Pairs"
        trigger={
          <span className="flex items-center gap-3">
            <span>{view === "default" ? "Default" : "Overrides"}</span>
            <span className="font-mono text-ink-3">{activeFirst}</span>
          </span>
        }
      >
        {(close) => (
          <div className="flex h-full min-h-0 flex-1 flex-col">
            <PairScopeNavigation
              value={view}
              onChange={setView}
              onSelect={() => {}}
            />
            <div className="mb-3 mt-4 shrink-0 border-t border-line" />
            <FirstTokenRail
              tokens={axes}
              active={activeFirst}
              filled={filled}
              total={Object.fromEntries(
                axes.map((a) => [a, axes.filter((b) => possible(a, b)).length]),
              )}
              onSelect={(token) => {
                selectFirst(token);
                close();
              }}
            />
            <div className="mt-auto shrink-0 border-t border-line pt-4 pb-1">
              <button
                type="button"
                onClick={() => {
                  close();
                  setDeletingFirst(activeFirst);
                }}
                className={`${DELETE_BUTTON_STYLE} mt-3 w-full gap-2 text-left text-[13px] font-medium`}
              >
                <Trash2Icon size={15} aria-hidden />
                Delete {activeFirst} pairs
              </button>
            </div>
          </div>
        )}
      </SubNavigation>
      <main
        data-pairs-scroll
        className="scroll-quiet min-h-0 min-w-0 flex-1 overflow-y-auto px-5 pb-8 md:px-10"
      >
        <div className="mx-auto w-full max-w-[1040px]">
          <header className="pb-5 pt-6 md:pb-6 md:pt-8">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-baseline gap-3">
                <h1 className="text-[18px] font-medium leading-none text-ink">
                  <span className="sr-only">Pairs starting with </span>
                  <span className="font-mono">{activeFirst}</span>
                  <span aria-hidden> pairs</span>
                </h1>
                <span className="text-[12px] text-ink-3">
                  {view === "default"
                    ? `${filled[activeFirst] ?? 0} / ${total} filled`
                    : "Overrides"}
                </span>
              </div>
            </div>
          </header>
          <PairGroups
            first={activeFirst}
            view={view}
            rows={rows}
            focus={Math.min(focus, rows.length - 1)}
            onFocus={setFocus}
            onOpen={open}
            onKeyDown={onKeyDown}
            refocus={refocus}
            jumpRequest={jumpRequest}
          />
        </div>
      </main>

      <AnimatePresence>
        {editing && possible(activeFirst, editing) && (
          <PairEditor
            key={`${activeFirst}|${editing}`}
            first={activeFirst}
            second={editing}
            entry={pairs[pairKey(activeFirst, editing)]}
            availableOverrides={(["edges", "corners"] as const).filter(
              (piece) =>
                overrideTokens[piece].includes(activeFirst) &&
                overrideTokens[piece].includes(editing),
            )}
            suggestionsOpen={!!init.suggestions}
            onClose={closeEditor}
            onSave={(entry) => {
              savePair(pairKey(activeFirst, editing), entry);
              closeEditor();
            }}
          />
        )}
      </AnimatePresence>
      <ConfirmDialog
        open={deletingFirst !== null}
        title={`Delete ${deletingFirst} pairs?`}
        body={`This will remove all Default, Edge and Corner words for pairs beginning with ${deletingFirst}. This can’t be undone.`}
        onCancel={() => setDeletingFirst(null)}
        confirm={{
          label: `Delete ${deletingFirst} pairs`,
          onClick: deleteSelectedPairs,
          tone: "danger",
        }}
      />

      <ShortcutSheet
        open={sheet.open}
        onClose={sheet.closeSheet}
        page="pairs"
      />
    </div>
  );
}
