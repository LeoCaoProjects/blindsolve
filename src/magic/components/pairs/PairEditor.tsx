import React, { useEffect, useMemo, useRef, useState } from "react";
import { SparklesIcon, XIcon } from "lucide-react";
import type { PairEntry, PairScope } from "../../types/app";
import { primaryWords } from "../../utils/pairs";
import { IconButton } from "../common/IconButton";
import { PairEditorDialog } from "./PairEditorDialog";
import { PrimaryButton, QuietButton } from "../common/PrimaryButton";
import { ConfirmDialog } from "../common/ConfirmDialog";
import { SuggestionMenu } from "../common/SuggestWords";
import { Popover } from "../common/Popover";
import { PairTokens } from "./PairTokens";

interface PairEditorProps {
  first: string;
  second: string;
  entry: PairEntry | undefined;
  suggestionsOpen?: boolean;
  availableOverrides?: ("edges" | "corners")[];
  onSave: (entry: PairEntry | null) => void;
  onClose: () => void;
}
const overrideScopes = ["edges", "corners"] as const;
const scopeLabel = (scope: PairScope) =>
  scope === "shared"
    ? "Default word"
    : scope === "edges"
      ? "Edge override"
      : "Corner override";
type Panel = {
  anchor: HTMLButtonElement;
};
const fieldStyle =
  "h-11 w-full min-w-0 rounded-[4px] border border-line-strong bg-surface pl-3 pr-10 text-[16px] text-ink caret-accent outline-none placeholder:text-ink-3 focus:rounded-[4px] focus:border-ink-3";

/** A fixed editor with reserved rows and one floating tools surface. */
export function PairEditor({
  first,
  second,
  entry,
  suggestionsOpen = false,
  availableOverrides = [...overrideScopes],
  onSave,
  onClose,
}: PairEditorProps) {
  const [draft, setDraft] = useState<PairEntry>(() => entry ?? { shared: [] });
  const [confirmClear, setConfirmClear] = useState(false);
  const [panel, setPanel] = useState<Panel | null>(null);
  const refs = useRef<Partial<Record<PairScope, HTMLInputElement | null>>>({});
  const defaultSuggest = useRef<HTMLButtonElement>(null);
  const anchorRef = useMemo(
    () => ({ current: panel?.anchor ?? null }),
    [panel?.anchor],
  );
  useEffect(() => {
    if (suggestionsOpen && defaultSuggest.current)
      setPanel({
        anchor: defaultSuggest.current,
      });
  }, [suggestionsOpen]);
  const savedCount = entry
    ? entry.shared.length +
      (entry.edges?.length ?? 0) +
      (entry.corners?.length ?? 0)
    : 0;
  const setWords = (scope: PairScope, words: string[]) =>
    setDraft((current) => ({ ...current, [scope]: words }));
  const save = () => {
    const current = { ...draft };
    const out: PairEntry = { shared: primaryWords(current.shared) };
    for (const scope of overrideScopes) {
      if (current[scope] === undefined) continue;
      const values = primaryWords(current[scope] ?? []);
      if (values.length) out[scope] = values;
    }
    onSave(
      !out.shared.length && !out.edges?.length && !out.corners?.length
        ? null
        : out,
    );
  };
  const togglePanel = (anchor: HTMLButtonElement) =>
    setPanel((current) => (current ? null : { anchor }));
  const field = (scope: PairScope) => {
    const words = draft[scope] ?? [],
      primary = words[0] ?? "";
    return (
      <>
        <div className="relative h-11">
          <input
            ref={(el) => {
              refs.current[scope] = el;
            }}
            data-dialog-autofocus={scope === "shared" ? "" : undefined}
            autoFocus={scope === "shared"}
            aria-label={scopeLabel(scope)}
            disabled={scope !== "shared" && !availableOverrides.includes(scope)}
            value={primary}
            placeholder={scope === "shared" ? "Enter word" : "Optional"}
            onChange={(event) => setWords(scope, [event.target.value])}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                event.preventDefault();
                save();
              }
            }}
            className={fieldStyle}
          />
          {scope === "shared" && (
            <button
              ref={defaultSuggest}
              type="button"
              aria-label={`Suggest words for ${scopeLabel(scope).toLowerCase()}`}
              aria-haspopup="dialog"
              aria-expanded={panel !== null}
              onClick={(event) => togglePanel(event.currentTarget)}
              className="absolute right-1 top-1 flex h-9 w-8 items-center justify-center rounded-[4px] text-ink-3 transition-colors hover:bg-hover hover:text-ink"
            >
              <SparklesIcon size={14} strokeWidth={1.75} aria-hidden />
            </button>
          )}
        </div>
      </>
    );
  };
  const primary = draft.shared[0] ?? "";
  return (
    <PairEditorDialog label={`Pair ${first}${second}`} onClose={onClose}>
      <header className="shrink-0 px-6 pb-4 pt-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <PairTokens
              first={first}
              second={second}
              className="block font-mono text-[26px] font-medium leading-none tracking-[0.04em] text-ink"
            />
          </div>
          <div className="-mr-2 -mt-1">
            <IconButton label="Close" onClick={onClose}>
              <XIcon />
            </IconButton>
          </div>
        </div>
      </header>
      <div
        data-pair-editor-body
        className="scroll-quiet min-h-0 flex-1 overflow-y-auto px-6 pb-5"
      >
        <section aria-label="Default word" className="h-[100px]">
          <p className="mb-2 flex items-baseline gap-2 text-[13px] font-medium text-ink-2">
            <span className="shrink-0">Default word</span>
            <span className="text-[11px] font-normal text-ink-3">
              Used for both Edges and Corners
            </span>
          </p>
          {field("shared")}
        </section>
        <section
          aria-label="Optional overrides"
          className="mt-3 border-t border-line pt-5"
        >
          {overrideScopes.map((scope) => (
            <section
              key={scope}
              aria-label={scopeLabel(scope)}
              data-override-row={scope}
              className={scope === "edges" ? "h-[100px]" : undefined}
            >
              <p className="mb-2 text-[13px] font-medium text-ink-2">
                {scope === "edges" ? "Edge" : "Corner"}
                <span className="ml-2 text-[11px] font-normal text-ink-3">
                  Optional override
                </span>
              </p>
              {field(scope)}
            </section>
          ))}
        </section>
      </div>
      <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-line px-6 py-3 text-[12.5px]">
        {savedCount > 0 ? (
          <QuietButton
            onClick={() => {
              setPanel(null);
              setConfirmClear(true);
            }}
            className="text-[var(--danger)] hover:bg-[var(--danger-soft)]"
          >
            Clear pair
          </QuietButton>
        ) : (
          <span />
        )}
        <PrimaryButton
          onClick={save}
          hint=""
          className="min-w-[84px] justify-center"
        >
          Save
        </PrimaryButton>
      </footer>
      <Popover
        open={panel !== null}
        onClose={() => setPanel(null)}
        anchorRef={anchorRef}
        width={260}
        label={`Suggestions for ${first}${second}`}
        className="theme-workspace"
      >
        <div
          className="scroll-quiet max-h-[min(320px,65dvh)] overflow-y-auto"
          key="shared"
        >
          <SuggestionMenu
            first={first}
            second={second}
            current={primary}
            onPick={(word) => {
              setWords("shared", [word]);
              setPanel(null);
              refs.current.shared?.focus();
            }}
          />
        </div>
      </Popover>
      <ConfirmDialog
        open={confirmClear}
        title={`Clear ${first}${second}?`}
        body={`This removes ${savedCount === 1 ? "its saved word" : `all ${savedCount} saved words`}, including Default, Edge and Corner words.`}
        onCancel={() => setConfirmClear(false)}
        confirm={{
          label: "Clear pair",
          onClick: () => onSave(null),
          tone: "danger",
        }}
      />
    </PairEditorDialog>
  );
}
