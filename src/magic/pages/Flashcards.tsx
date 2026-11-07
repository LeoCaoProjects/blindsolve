import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { VirtualHistory } from "../components/common/VirtualHistory";
import { ArrowRightIcon, CheckIcon, XIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { RowDelete } from "../components/common/HistoryHeader";
import { useHistoryCleanup } from "../hooks/useHistoryCleanup";
import { ShortcutSheet } from "../components/common/ShortcutSheet";
import { AppBar } from "../components/layout/AppBar";
import { PairTokens } from "../components/pairs/PairTokens";
import { PairCube } from "../components/practice/PairCube";
import { SessionReadout } from "../components/practice/SessionReadout";
import { clamp, useElementSize } from "../hooks/useElementSize";
import { CardPhase, CardPiece, useFlashcards } from "../hooks/useFlashcards";
import { useShortcutSheet } from "../hooks/useShortcutSheet";
import { EASE_OUT } from "../utils/keyboard";
import { splitKey } from "../utils/pairs";
import { useScreenInit } from "../useScreenInit.js";

interface ScreenState {
  scope?: CardPiece | "both";
  card?: string;
  phase?: CardPhase;
}

export function Flashcards() {
  const init = useScreenInit() as ScreenState;
  const sheet = useShortcutSheet();
  const f = useFlashcards(init);
  const [cubeRef, cubeBox] = useElementSize<HTMLDivElement>({
    width: 392,
    height: 330,
  });
  const cubeSize = clamp(
    Math.min(cubeBox.width - 80, cubeBox.height - 48),
    140,
    250,
  );
  const cubeType = f.cardType;
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
    <div className="flex h-full w-full flex-col overflow-hidden bg-bg font-sans text-ink">
      <AppBar onShortcuts={sheet.openSheet} />

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_clamp(300px,28vw,392px)]">
        <main className="flex min-h-0 min-w-0 flex-col">
          <section className="flex shrink-0 items-center gap-6 border-b border-line px-5 py-2 md:px-10">
            <span className="hidden w-8 shrink-0 font-mono text-[11px] text-ink-3 tnum md:block">
              #{f.stats.seen + 1}
            </span>
            <span className="ml-auto font-mono text-[11.5px] text-ink-3 tnum">
              {f.eligibleCount} {f.eligibleCount === 1 ? "card" : "cards"}
            </span>
          </section>

          {!f.card || !f.cardTokens ? (
            <EmptyState />
          ) : (
            <>
              <div className="scroll-quiet flex min-h-0 flex-1 flex-col overflow-y-auto px-5 md:px-10">
                <div className="my-auto flex items-center justify-between gap-8 py-6 md:pl-14">
                  <div className="min-w-0">
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.div
                        key={f.cardId}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.14, ease: EASE_OUT }}
                      >
                        <PairTokens
                          first={f.cardTokens[0]}
                          second={f.cardTokens[1]}
                          className="block font-timer text-[clamp(72px,min(12vw,18vh),176px)] font-extralight leading-[0.9] tracking-[0.02em] text-ink"
                        />

                        <span className="mt-2 block text-[12.5px] text-ink-3">
                          {f.cardType === "edge" ? "Edge" : "Corner"}
                        </span>
                      </motion.div>
                    </AnimatePresence>

                    <div className="mt-[clamp(16px,3.5vh,32px)] min-h-[clamp(56px,11vh,112px)]">
                      {f.phase === "question" && (
                        <span
                          aria-hidden
                          className="block h-px w-16 bg-line-strong"
                        />
                      )}
                      {f.phase === "revealed" && (
                        <motion.div
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.16, ease: EASE_OUT }}
                        >
                          <p className="break-words text-[clamp(30px,5.5vh,52px)] leading-tight text-ink">
                            {f.words[0]}
                          </p>
                          {f.words.length > 1 && (
                            <p className="mt-2 text-[15px] text-ink-3">
                              {f.words.slice(1).join(" · ")}
                            </p>
                          )}
                        </motion.div>
                      )}
                      {(f.phase === "editing" || f.phase === "adding") && (
                        <InlineWordInput
                          key={f.phase}
                          initial={
                            f.phase === "editing" ? (f.words[0] ?? "") : ""
                          }
                          placeholder={
                            f.phase === "editing" ? "Word" : "Add alternate"
                          }
                          large={f.phase === "editing"}
                          above={f.phase === "adding" ? f.words[0] : undefined}
                          onSubmit={
                            f.phase === "editing"
                              ? f.editPrimary
                              : f.addAlternate
                          }
                          onCancel={() => f.setPhase("revealed")}
                        />
                      )}
                    </div>
                  </div>
                  <div className="hidden shrink-0 sm:block lg:hidden">
                    <PairCube
                      animateOrientation
                      tokens={f.cardTokens}
                      type={cubeType}
                      size={170}
                    />
                  </div>
                </div>
              </div>

              <CardDock
                phase={f.phase}
                onReveal={f.reveal}
                onNext={f.next}
                onPhase={f.setPhase}
              />
            </>
          )}
        </main>

        <aside className="hidden min-h-0 flex-col border-l border-line bg-surface lg:flex">
          <div
            ref={cubeRef}
            className="flex h-[clamp(210px,38vh,330px)] shrink-0 items-center justify-center border-b border-line"
          >
            {f.cardTokens && (
              <PairCube
                animateOrientation
                tokens={f.cardTokens}
                type={cubeType}
                size={cubeSize}
              />
            )}
          </div>
          <SessionReadout
            cells={[
              ["cards", String(f.stats.seen)],
              ["remembered", String(f.stats.remembered)],
              ["forgot", String(f.stats.forgot)],
            ]}
          />
          <VirtualHistory
            label="Recent cards"
            items={f.log}
            columns={2}
            rowHeight={36}
            empty="No recent cards"
            renderItem={(entry) => {
              const [a, b] = splitKey(entry.key);
              const forgot = entry.result === "forgot";
              return (
                <>
                  <RowDelete
                    label={`Remove ${a}${b} from history`}
                    onClick={() => f.removeLog(entry.id)}
                  />
                  <button
                    type="button"
                    title={entry.piece === "edges" ? "Edge" : "Corner"}
                    onClick={() => f.review(entry)}
                    className="grid w-full grid-cols-[34px_1fr_auto] items-center gap-2 py-[7px] pl-5 pr-9 text-left transition-colors duration-150 ease-out hover:bg-hover"
                  >
                    <PairTokens
                      first={a}
                      second={b}
                      className={`text-[13.5px] tracking-[0.08em] ${forgot ? "text-ink" : "text-ink-2"}`}
                    />
                    <span className="truncate text-[12px] text-ink-3">
                      {f.wordsForLog(entry)[0]}
                    </span>
                    {forgot ? (
                      <XIcon
                        size={13}
                        className="text-accent"
                        aria-label="forgot"
                      />
                    ) : (
                      <CheckIcon
                        size={13}
                        className="text-ink-3"
                        aria-label="remembered"
                      />
                    )}
                  </button>
                </>
              );
            }}
          />
        </aside>
      </div>
      <ShortcutSheet
        open={sheet.open}
        onClose={sheet.closeSheet}
        page="flashcards"
      />
      {cleanup.dialog}
    </div>
  );
}

/**
 * One fixed slot for every card action, lifted well off the floor.
 * Reveal and the responses occupy the same place, so the hand never has to travel.
 */
function CardDock({
  phase,
  onReveal,
  onNext,
  onPhase,
}: {
  phase: CardPhase;
  onReveal: () => void;
  onNext: (r: "remembered" | "forgot") => void;
  onPhase: (p: CardPhase) => void;
}) {
  const busy = phase === "editing" || phase === "adding";
  return (
    <section
      aria-label="Card actions"
      className="dock-inset shrink-0 px-5 pt-4 md:px-10 md:pl-24"
    >
      <div className="flex min-h-[44px] flex-wrap items-center gap-2">
        {phase === "question" ? (
          <DockButton primary onClick={onReveal} hint="Space">
            Reveal
          </DockButton>
        ) : (
          <>
            <DockButton
              primary
              onClick={() => onNext("remembered")}
              hint="↵"
              disabled={busy}
            >
              Remembered
            </DockButton>
            <DockButton
              onClick={() => onNext("forgot")}
              hint="F"
              disabled={busy}
            >
              Forgot
            </DockButton>
            <span
              aria-hidden
              className="mx-2 hidden h-5 w-px bg-line sm:block"
            />
            <DockButton
              quiet
              onClick={() => onPhase("editing")}
              hint="E"
              disabled={busy}
            >
              Edit
            </DockButton>
            <DockButton
              quiet
              onClick={() => onPhase("adding")}
              hint="A"
              disabled={busy}
            >
              Add alternate
            </DockButton>
          </>
        )}
      </div>
    </section>
  );
}

function DockButton({
  children,
  onClick,
  hint,
  primary,
  quiet,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  hint: string;
  primary?: boolean;
  quiet?: boolean;
  disabled?: boolean;
}) {
  const tone = primary
    ? "bg-ink text-bg font-medium hover:opacity-90"
    : quiet
      ? "text-ink-3 hover:bg-hover hover:text-ink-2"
      : "border border-line-strong text-ink hover:bg-hover";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-11 items-center gap-3 whitespace-nowrap rounded-[4px] px-4 text-[13.5px] transition-[opacity,background-color,color] duration-150 ease-out disabled:opacity-30 ${tone}`}
    >
      {children}
      <span
        className={`font-mono text-[11px] ${primary ? "opacity-50" : "text-ink-3"}`}
      >
        {hint}
      </span>
    </button>
  );
}

function InlineWordInput({
  initial,
  placeholder,
  large,
  above,
  onSubmit,
  onCancel,
}: {
  initial: string;
  placeholder: string;
  large: boolean;
  above?: string;
  onSubmit: (w: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <div>
      {above && (
        <p className="mb-3 text-[clamp(30px,5.5vh,52px)] leading-tight text-ink-2">
          {above}
        </p>
      )}
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
        className={`w-full max-w-[640px] border-b border-accent bg-transparent pb-1 text-ink outline-none placeholder:text-ink-3 ${
          large ? "text-[clamp(30px,5.5vh,52px)]" : "text-[20px]"
        }`}
      />

      <p className="mt-3 flex gap-1 text-[12.5px] text-ink-3">
        <button
          type="button"
          onClick={() => onSubmit(value)}
          className="inline-flex h-8 items-center rounded-[4px] px-2 transition-colors duration-150 hover:bg-hover hover:text-ink-2"
        >
          Save <span className="ml-2 font-mono text-[11px]">↵</span>
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
    <div className="flex flex-1 flex-col justify-center px-5 md:px-10 md:pl-24">
      <p className="text-[22px] text-ink">No pairs yet</p>
      <Link
        to="/pairs"
        className="mt-3 inline-flex w-fit items-center gap-2 text-[14px] text-ink-2 transition-colors duration-150 ease-out hover:text-ink"
      >
        Add your first word
        <ArrowRightIcon size={14} strokeWidth={1.75} />
      </Link>
    </div>
  );
}
