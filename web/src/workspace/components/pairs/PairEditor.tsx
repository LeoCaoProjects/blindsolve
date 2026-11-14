import React, { useRef, useState } from "react";
import { useIsPresent } from "framer-motion";
import { XIcon } from "lucide-react";
import type { PairEntry, PairScope } from "../../types/app";
import { primaryWords } from "../../utils/pairs";
import { IconButton } from "../common/IconButton";
import { PairEditorDialog } from "./PairEditorDialog";
import { PrimaryButton, QuietButton } from "../common/PrimaryButton";
import { ConfirmDialog } from "../common/ConfirmDialog";
import { DefaultWordField, PAIR_WORD_FIELD } from "./DefaultWordField";
import { PairTokens } from "./PairTokens";

interface PairEditorProps {
  first: string;
  second: string;
  entry: PairEntry | undefined;
  suggestionsOpen?: boolean;
  availableOverrides?: ("edges" | "corners")[];
  onSave: (entry: PairEntry | null) => void;
  onClose: () => void;
  contextKey?: string;
}
const overrideScopes = ["edges", "corners"] as const;
const scopeLabel = (scope: PairScope) =>
  scope === "shared"
    ? "Default word"
    : scope === "edges"
      ? "Edge override"
      : "Corner override";
/** A fixed editor with reserved rows and one floating tools surface. */
export function PairEditor({
  first,
  second,
  entry,
  suggestionsOpen = false,
  availableOverrides = [...overrideScopes],
  onSave,
  onClose,
  contextKey,
}: PairEditorProps) {
  const present = useIsPresent();
  const snapshot = JSON.stringify([first, second, entry, availableOverrides, contextKey]);
  const opened = useRef(snapshot);
  const stale = opened.current !== snapshot;
  const [draft, setDraft] = useState<PairEntry>(() => entry ?? { shared: [] });
  const [confirmClear, setConfirmClear] = useState(false);
  const savedCount = entry
    ? entry.shared.length +
      (entry.edges?.length ?? 0) +
      (entry.corners?.length ?? 0)
    : 0;
  const setWords = (scope: PairScope, words: string[]) =>
    setDraft((current) => ({ ...current, [scope]: words }));
  const save = () => {
    if (stale || !present) return;
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
  const field = (scope: PairScope) => {
    if (scope === "shared")
      return (
        <DefaultWordField
          first={first}
          second={second}
          value={draft.shared[0] ?? ""}
          onChange={(word) => setWords("shared", [word])}
          onSubmit={save}
          suggestionsOpen={suggestionsOpen}
        />
      );
    const words = draft[scope] ?? [],
      primary = availableOverrides.includes(scope) ? words[0] ?? "" : "";
    return (
      <>
        <div className="relative h-11">
          <input
            aria-label={scopeLabel(scope)}
            disabled={!availableOverrides.includes(scope)}
            value={primary}
            placeholder={availableOverrides.includes(scope) ? "Optional" : "Not used by this lettering"}
            onChange={(event) => setWords(scope, [event.target.value])}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                event.preventDefault();
                save();
              }
            }}
            className={PAIR_WORD_FIELD}
          />
        </div>
      </>
    );
  };
  return (
    <PairEditorDialog label={`Pair ${first}${second}`} onClose={onClose}>
      {stale && <p role="alert" className="px-6 pt-4 text-sm">This pair or its lettering changed. Copy your draft, then close and reopen the editor before saving.</p>}
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
      <ConfirmDialog
        open={confirmClear}
        title={`Clear ${first}${second}?`}
        body={`This removes ${savedCount === 1 ? "its saved word" : `all ${savedCount} saved words`}, including Default, Edge and Corner words.`}
        onCancel={() => setConfirmClear(false)}
        confirm={{
          label: "Clear pair",
          onClick: () => { if (!stale && present) onSave(null); },
          tone: "danger",
        }}
      />
    </PairEditorDialog>
  );
}
