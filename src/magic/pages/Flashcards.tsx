import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRightIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { useSessionWorkspace } from "../contexts/SessionWorkspaceContext";
import { useHistoryCleanup } from "../hooks/useHistoryCleanup";
import { ShortcutSheet } from "../components/common/ShortcutSheet";
import { PrimaryButton, QuietButton } from "../components/common/PrimaryButton";
import { AppBar } from "../components/layout/AppBar";
import { PairTokens } from "../components/pairs/PairTokens";
import { PairCube } from "../components/practice/PairCube";
import { useShortcutSheet } from "../hooks/useShortcutSheet";
import { EASE_OUT } from "../utils/keyboard";
import { splitKey } from "../utils/pairs";

export function Flashcards() {
  const { flashcards: f } = useSessionWorkspace();
  const sheet = useShortcutSheet();
  const latestLog = f.log[0];
  const cleanup = useHistoryCleanup({
    count: f.log.length,
    noun: "card",
    scope: "your Flashcard history",
    latestLabel: latestLog ? splitKey(latestLog.key).join("") : undefined,
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
            aria-label="Flashcard"
            className="m-auto flex w-full min-w-0 max-w-[560px] flex-col items-center text-center"
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
              aria-live="polite"
              className="flex h-[104px] vp-md:h-[140px] w-full items-center justify-center py-5"
            >
              {f.phase === "question" && (
                <span aria-hidden className="h-px w-12 bg-line-strong" />
              )}
              {f.phase === "revealed" && (
                <motion.p
                  key={f.cardId}
                  initial={{ opacity: 0, y: 3 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.14, ease: EASE_OUT }}
                  className="max-h-full overflow-y-auto break-words text-[clamp(26px,4.5vh,40px)] leading-tight text-ink"
                >
                  {f.words[0]}
                </motion.p>
              )}
              {f.phase === "editing" && (
                <InlineWordInput
                  initial={f.words[0] ?? ""}
                  placeholder="Word"
                  onSubmit={f.editPrimary}
                  onCancel={() => f.setPhase("revealed")}
                />
              )}
            </div>
            <fieldset
              aria-label="Card actions"
              disabled={f.phase === "editing"}
              className="flex h-11 w-full min-w-0 items-center justify-center border-0 p-0"
            >
              {f.phase === "question" ? (
                <PrimaryButton
                  onClick={f.reveal}
                  hint="Space"
                  className="min-w-[132px] justify-center"
                >
                  Reveal
                </PrimaryButton>
              ) : (
                <div className="grid w-full max-w-[360px] grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)] gap-1.5">
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
                    onClick={() => f.setPhase("editing")}
                    className="justify-center gap-2 border border-line-strong !px-2"
                  >
                    Edit <KeyHint>3</KeyHint>
                  </QuietButton>
                </div>
              )}
            </fieldset>
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

function InlineWordInput({
  initial,
  placeholder,
  onSubmit,
  onCancel,
}: {
  initial: string;
  placeholder: string;
  onSubmit: (w: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <div>
      <input
        autoFocus
        aria-label={placeholder}
        value={value}
        placeholder={placeholder}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onSubmit(value);
          }
          if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
          }
        }}
        className="w-full max-w-[640px] border-b border-accent bg-transparent pb-1 text-[clamp(30px,5.5vh,52px)] text-ink outline-none placeholder:text-ink-3"
      />

      <p className="mt-3 flex gap-1 text-[12.5px] text-ink-3">
        <button
          type="button"
          onClick={() => onSubmit(value)}
          className="inline-flex h-8 items-center rounded-[4px] px-2 transition-colors duration-150 hover:bg-hover hover:text-ink-2"
        >
          Save as default <span className="ml-2 font-mono text-[11px]">↵</span>
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-8 items-center rounded-[4px] px-2 transition-colors duration-150 hover:bg-hover hover:text-ink-2"
        >
          Cancel <span className="ml-2 font-mono text-[11px]">esc</span>
        </button>
      </p>
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
