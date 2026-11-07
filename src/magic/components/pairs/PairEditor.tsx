import React, { useEffect, useMemo, useRef, useState } from "react";
import { SparklesIcon, XIcon } from "lucide-react";
import type { PairEntry, PairScope } from "../../types/app";
import { normalizeWords } from "../../utils/pairs";
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
  uses: number;
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
  kind: "suggestions" | "alternates";
  scope: PairScope;
  anchor: HTMLButtonElement;
};
const fieldStyle =
  "h-11 w-full min-w-0 rounded-[4px] border border-line-strong bg-surface pl-3 pr-10 text-[16px] text-ink caret-accent outline-none placeholder:text-ink-3 focus:rounded-[4px] focus:border-ink-3";

/** A fixed editor with reserved rows and one floating tools surface. */
export function PairEditor({
  first,
  second,
  entry,
  uses,
  suggestionsOpen = false,
  availableOverrides = [...overrideScopes],
  onSave,
  onClose,
}: PairEditorProps) {
  const [draft, setDraft] = useState<PairEntry>(() => entry ?? { shared: [] });
  const [alt, setAlt] = useState<Record<PairScope, string>>({
    shared: "",
    edges: "",
    corners: "",
  });
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
        kind: "suggestions",
        scope: "shared",
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
  const removeOverride = (scope: "edges" | "corners") => {
    setPanel(null);
    setDraft((current) => {
      const next = { ...current };
      delete next[scope];
      return next;
    });
    setAlt((current) => ({ ...current, [scope]: "" }));
  };
  const save = () => {
    const current = { ...draft };
    for (const scope of ["shared", ...overrideScopes] as const)
      if (alt[scope].trim())
        current[scope] = normalizeWords([
          ...(current[scope] ?? []),
          alt[scope],
        ]);
    const out: PairEntry = { shared: normalizeWords(current.shared) };
    for (const scope of overrideScopes) {
      if (current[scope] === undefined) continue;
      const values = normalizeWords(current[scope] ?? []);
      if (values.length) out[scope] = values;
    }
    onSave(
      !out.shared.length && !out.edges?.length && !out.corners?.length
        ? null
        : out,
    );
  };
  const togglePanel = (
    kind: Panel["kind"],
    scope: PairScope,
    anchor: HTMLButtonElement,
  ) =>
    setPanel((current) =>
      current?.scope === scope && current.kind === kind
        ? null
        : { kind, scope, anchor },
    );
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
            value={primary}
            placeholder="Enter word"
            onChange={(event) =>
              setWords(scope, [event.target.value, ...words.slice(1)])
            }
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                event.preventDefault();
                save();
              }
            }}
            className={fieldStyle}
          />
          <button
            ref={scope === "shared" ? defaultSuggest : undefined}
            type="button"
            aria-label={`Suggest words for ${scopeLabel(scope).toLowerCase()}`}
            aria-haspopup="dialog"
            aria-expanded={
              panel?.kind === "suggestions" && panel.scope === scope
            }
            onClick={(event) =>
              togglePanel("suggestions", scope, event.currentTarget)
            }
            className="absolute right-1 top-1 flex h-9 w-8 items-center justify-center rounded-[4px] text-ink-3 transition-colors hover:bg-hover hover:text-ink"
          >
            <SparklesIcon size={14} strokeWidth={1.75} aria-hidden />
          </button>
        </div>
        <div className="flex h-7 items-center">
          <button
            type="button"
            aria-label={`Alternative words for ${scopeLabel(scope).toLowerCase()}`}
            aria-haspopup="dialog"
            aria-expanded={
              panel?.kind === "alternates" && panel.scope === scope
            }
            onClick={(event) =>
              togglePanel("alternates", scope, event.currentTarget)
            }
            className="text-[11px] text-ink-3 transition-colors hover:text-ink"
          >
            Alternative words{words.length > 1 ? ` (${words.length - 1})` : ""}
          </button>
        </div>
      </>
    );
  };
  const activeScope = panel?.scope ?? "shared";
  const activeWords = draft[activeScope] ?? [];
  const primary = activeWords[0] ?? "",
    alternates = activeWords.slice(1);
  const addAlternate = () => {
    if (!alt[activeScope].trim()) return;
    setWords(
      activeScope,
      normalizeWords(
        primary
          ? [...activeWords, alt[activeScope]]
          : [alt[activeScope], ...alternates],
      ),
    );
    setAlt((current) => ({ ...current, [activeScope]: "" }));
  };
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
            {uses > 0 && (
              <p className="mt-2 text-[12px] text-ink-3">
                Used in {uses} solves
              </p>
            )}
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
          <p className="mb-2 text-[12px] text-ink-2">Default word</p>
          {field("shared")}
        </section>
        <section
          aria-label="Optional overrides"
          className="mt-4 border-t border-line pt-4"
        >
          <h3 className="mb-4 text-[12px] text-ink-2">
            Overrides{" "}
            <span className="ml-1 text-[11px] text-ink-3">Optional</span>
          </h3>
          {overrideScopes.map((scope) => {
            const exists = draft[scope] !== undefined;
            if (!exists && !availableOverrides.includes(scope)) return null;
            return (
              <section
                key={scope}
                aria-label={scopeLabel(scope)}
                data-override-row={scope}
                className="h-[100px]"
              >
                <div className="mb-2 flex h-[18px] items-center justify-between gap-3">
                  <span className="text-[12px] text-ink-2">
                    {scope === "edges" ? "Edge" : "Corner"}
                  </span>
                  {exists && (
                    <button
                      type="button"
                      onClick={() => removeOverride(scope)}
                      className="text-[11px] text-ink-3 transition-colors hover:text-ink"
                    >
                      Use default
                    </button>
                  )}
                </div>
                {exists ? (
                  field(scope)
                ) : (
                  <div className="flex h-11 items-center">
                    <button
                      type="button"
                      aria-label={`Add ${scope === "edges" ? "edge" : "corner"} override`}
                      onClick={() => {
                        setWords(scope, [...draft.shared]);
                        requestAnimationFrame(() =>
                          refs.current[scope]?.focus(),
                        );
                      }}
                      className="text-[12px] text-ink-3 transition-colors hover:text-ink"
                    >
                      Add override
                    </button>
                  </div>
                )}
              </section>
            );
          })}
        </section>
      </div>
      <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-line px-6 py-3 text-[12.5px]">
        {savedCount > 0 ? (
          <QuietButton
            onClick={() => {
              setPanel(null);
              setConfirmClear(true);
            }}
            className="text-danger hover:bg-danger-soft"
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
        label={
          panel?.kind === "suggestions"
            ? `Suggestions for ${first}${second}`
            : `Alternative words for ${scopeLabel(activeScope).toLowerCase()}`
        }
        className="theme-workspace"
      >
        <div
          className="scroll-quiet max-h-[min(320px,65dvh)] overflow-y-auto"
          key={`${panel?.kind}-${activeScope}`}
        >
          {panel?.kind === "suggestions" ? (
            <SuggestionMenu
              first={first}
              second={second}
              exclude={alternates}
              current={primary}
              onPick={(word) => {
                setWords(activeScope, [word, ...alternates]);
                setPanel(null);
                refs.current[activeScope]?.focus();
              }}
            />
          ) : (
            panel && (
              <div className="p-2">
                <p className="mb-2 text-[12px] text-ink-2">Alternative words</p>
                <ul>
                  {alternates.map((word, index) => (
                    <li
                      key={`${word}-${index}`}
                      className="flex min-h-9 items-center gap-2"
                    >
                      <button
                        type="button"
                        title="Make primary"
                        onClick={() =>
                          setWords(
                            activeScope,
                            [
                              word,
                              primary,
                              ...alternates.filter((_, i) => i !== index),
                            ].filter(Boolean),
                          )
                        }
                        className="min-w-0 flex-1 truncate py-2 text-left text-[13px] text-ink-2 hover:text-ink"
                      >
                        {word}
                      </button>
                      <IconButton
                        size="sm"
                        label={`Remove ${word}`}
                        onClick={() =>
                          setWords(activeScope, [
                            primary,
                            ...alternates.filter((_, i) => i !== index),
                          ])
                        }
                      >
                        <XIcon />
                      </IconButton>
                    </li>
                  ))}
                </ul>
                <input
                  autoFocus
                  aria-label="Add alternate"
                  value={alt[activeScope]}
                  placeholder="Enter alternate"
                  onChange={(event) =>
                    setAlt((current) => ({
                      ...current,
                      [activeScope]: event.target.value,
                    }))
                  }
                  onBlur={addAlternate}
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" &&
                      !event.nativeEvent.isComposing
                    ) {
                      event.preventDefault();
                      addAlternate();
                    }
                  }}
                  className="mt-2 h-9 w-full min-w-0 rounded-[4px] border border-line-strong bg-surface px-3 text-[14px] text-ink outline-none placeholder:text-ink-3 focus:rounded-[4px]"
                />
                {primary.trim() && (
                  <button
                    type="button"
                    onClick={() => setWords(activeScope, alternates)}
                    className="mt-3 text-[12px] text-ink-3 hover:text-ink"
                  >
                    Remove word
                  </button>
                )}
              </div>
            )
          )}
        </div>
      </Popover>
      <ConfirmDialog
        open={confirmClear}
        title={`Clear ${first}${second}?`}
        body={`This removes ${savedCount === 1 ? "its saved word" : `all ${savedCount} saved words`}, including alternates and edge or corner overrides.`}
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
