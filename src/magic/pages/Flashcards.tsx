import {
  displayMemoPair,
  memoPairReference,
} from "../../domain/letterPairs/identity";
import { useRef, useState, type ReactNode } from "react";
import {
  AnimatePresence,
  motion,
  useIsPresent,
  useReducedMotion,
} from "framer-motion";
import { ArrowRightIcon } from "lucide-react";
import { WorkspaceLink as Link } from "../navigation/workspaces";
import { useSessionWorkspace } from "../contexts/SessionWorkspaceContext";
import { useHistoryCleanup } from "../hooks/useHistoryCleanup";
import { ShortcutSheet } from "../components/common/ShortcutSheet";
import { PrimaryButton, QuietButton } from "../components/common/PrimaryButton";
import { AppBar } from "../components/layout/AppBar";
import { PairTokens } from "../components/pairs/PairTokens";
import { DefaultWordField } from "../components/pairs/DefaultWordField";
import { PairCube } from "../components/practice/PairCube";
import { useShortcutSheet } from "../hooks/useShortcutSheet";
import { EASE_OUT } from "../utils/keyboard";
import { splitKey } from "../utils/pairs";

export function Flashcards() {
  const { flashcards: f } = useSessionWorkspace();
  const reduced = useReducedMotion();
  const sheet = useShortcutSheet();
  const workspace = useRef<HTMLElement>(null);
  const finishEditing = () => {
    f.setPhase("revealed");
    workspace.current?.focus({ preventScroll: true });
  };
  const latestLog = f.log[0];
  const cleanup = useHistoryCleanup({
    count: f.log.length,
    noun: "card",
    scope: "your Flashcard history",
    latestLabel: latestLog
      ? displayMemoPair(memoPairReference(splitKey(latestLog.key)))
      : undefined,
    removeLatest: f.removeLatestLog,
    clearAll: f.clearLog,
    keysEnabled: f.phase === "question" || f.phase === "revealed",
  });
  return (
    <main className="flex h-full min-h-0 min-w-0 flex-col bg-bg font-sans text-ink">
      <AppBar onShortcuts={sheet.openSheet} />
      {!f.card || !f.cardTokens ? (
        <EmptyState />
      ) : (
        <div className="scroll-quiet flex min-h-0 flex-1 overflow-y-auto px-5 py-6 vp-md:px-10">
          <section
            ref={workspace}
            tabIndex={-1}
            aria-label="Flashcard"
            className="m-auto flex w-full min-w-0 max-w-[560px] flex-col items-center text-center outline-none focus-visible:outline-none"
          >
            <div className="mb-3 vp-md:hidden">
              <PairCube
                tokens={f.cardTokens}
                type={f.cardType}
                size={96}
                animateOrientation
              />
            </div>
            <PairTokens
              first={f.cardTokens[0]}
              second={f.cardTokens[1]}
              className="block font-timer text-[clamp(64px,12vh,144px)] vp-md:text-[clamp(80px,14vh,144px)] font-extralight leading-none tracking-[0.02em] text-ink"
            />
            <span className="mt-2 text-[12.5px] text-ink-3">
              {f.cardType === "edge" ? "Edge" : "Corner"}
            </span>
            <div
              data-flashcard-interaction
              className="relative h-[148px] w-full shrink-0 vp-md:h-[184px]"
            >
              <AnimatePresence initial={false}>
                {f.phase === "editing" ? (
                  <StateLayer key={`editing-${f.editSession}`} name="editing">
                    <DefaultWordEditor
                      first={f.cardTokens[0]}
                      second={f.cardTokens[1]}
                      initial={f.defaultWord}
                      onSave={(word) => {
                        f.editPrimary(word);
                        finishEditing();
                      }}
                      onCancel={finishEditing}
                    />
                  </StateLayer>
                ) : (
                  <StateLayer key="practice" name="practice">
                    <div
                      aria-live="polite"
                      className="flex h-[104px] w-full shrink-0 items-center justify-center py-5 vp-md:h-[140px]"
                    >
                      {f.phase === "question" ? (
                        <span
                          aria-hidden
                          className="h-px w-12 bg-line-strong"
                        />
                      ) : (
                        <motion.p
                          key={f.cardId}
                          initial={{
                            opacity: reduced ? 1 : 0,
                            y: reduced ? 0 : 3,
                          }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{
                            duration: reduced ? 0 : 0.14,
                            ease: EASE_OUT,
                          }}
                          className="max-h-full overflow-y-auto break-words text-[clamp(26px,4.5vh,40px)] leading-tight text-ink"
                        >
                          {f.words[0]}
                        </motion.p>
                      )}
                    </div>
                    <fieldset
                      aria-label="Card actions"
                      className="flex h-11 w-full min-w-0 shrink-0 items-center justify-center border-0 p-0"
                    >
                      <div
                        data-flashcard-controls
                        className="relative h-full w-full max-w-[360px]"
                      >
                        <AnimatePresence initial={false}>
                          {f.phase === "question" ? (
                            <StateLayer key="reveal" name="reveal">
                              <PrimaryButton
                                onClick={f.reveal}
                                hint="Space"
                                className="min-w-[132px] justify-center"
                              >
                                Reveal
                              </PrimaryButton>
                            </StateLayer>
                          ) : (
                            <StateLayer key="review" name="review">
                              <div className="grid w-full grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)] gap-1.5">
                                <PrimaryButton
                                  onClick={() => f.next("remembered")}
                                  hint="1"
                                  className="justify-center !gap-1.5 !px-2 [&_span]:hidden vp-md:[&_span]:inline"
                                >
                                  Remembered
                                </PrimaryButton>
                                <QuietButton
                                  onClick={() => f.next("forgot")}
                                  className="justify-center gap-2 border border-line-strong !px-2 text-ink"
                                >
                                  Forgot <KeyHint>2</KeyHint>
                                </QuietButton>
                                <QuietButton
                                  onClick={f.beginEdit}
                                  className="justify-center gap-2 border border-line-strong !px-2"
                                >
                                  Edit <KeyHint>3</KeyHint>
                                </QuietButton>
                              </div>
                            </StateLayer>
                          )}
                        </AnimatePresence>
                      </div>
                    </fieldset>
                  </StateLayer>
                )}
              </AnimatePresence>
            </div>
          </section>
        </div>
      )}
      <ShortcutSheet
        open={sheet.open}
        onClose={sheet.closeSheet}
        page="flashcards"
      />
      {cleanup.dialog}
    </main>
  );
}

function KeyHint({ children }: { children: string }) {
  return (
    <span className="hidden font-mono text-[11px] text-ink-3 vp-md:inline">
      {children}
    </span>
  );
}

/** Only opacity/translation animate; every state uses the already-reserved bounds.
 * Exiting layers immediately stop accepting focus, pointer and shortcut actions. */
function StateLayer({ children, name }: { children: ReactNode; name: string }) {
  const present = useIsPresent();
  const reduced = useReducedMotion();
  return (
    <motion.div
      data-flashcard-state={name}
      inert={!present}
      aria-hidden={!present || undefined}
      initial={{ opacity: 0, y: reduced ? 0 : 3 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: reduced ? 0 : -2 }}
      transition={{ duration: reduced ? 0 : 0.16, ease: EASE_OUT }}
      className={`absolute inset-0 flex flex-col items-center justify-center ${present ? "" : "pointer-events-none"}`}
    >
      {children}
    </motion.div>
  );
}

function DefaultWordEditor({
  first,
  second,
  initial,
  onSave,
  onCancel,
}: {
  first: string;
  second: string;
  initial: string;
  onSave: (word: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  const save = () => {
    if (value.trim()) onSave(value.trim());
  };
  return (
    <div
      className="flex h-full w-full max-w-[360px] flex-col"
      onKeyDown={(event) => {
        if (event.key === "Escape" && !event.nativeEvent.isComposing) {
          event.preventDefault();
          event.stopPropagation();
          if (!event.repeat) onCancel();
        }
      }}
    >
      <div className="flex h-[104px] shrink-0 flex-col justify-center text-left vp-md:h-[140px]">
        <p className="mb-2 flex flex-wrap items-baseline gap-x-2 text-[13px] font-medium text-ink-2">
          <span>Default word</span>
          <span className="text-[11px] font-normal text-ink-3">
            Used for both Edges and Corners
          </span>
        </p>
        <DefaultWordField
          first={first}
          second={second}
          value={value}
          onChange={setValue}
          onSubmit={save}
        />
      </div>
      <div className="flex h-11 shrink-0 items-center justify-end gap-2">
        <QuietButton onClick={onCancel}>Cancel</QuietButton>
        <PrimaryButton
          onClick={save}
          disabled={!value.trim()}
          hint=""
          className="min-w-[84px] justify-center"
        >
          Save
        </PrimaryButton>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-5 text-center">
      <p className="text-[22px] text-ink">No pairs yet</p>
      <Link
        to="/pairs"
        className="mt-3 inline-flex items-center gap-2 text-[14px] text-ink-2 hover:text-ink"
      >
        Add your first word <ArrowRightIcon size={14} strokeWidth={1.75} />
      </Link>
    </div>
  );
}
