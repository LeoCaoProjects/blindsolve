import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { TrainingSession } from "../../hooks/useTrainingSession";
import { SchemeCube } from "../cube/SchemeCube";
import { CompactTrainingTimer } from "./CompactTrainingTimer";
import { recognitionPieceStickers } from "../../utils/recognition";
import { bestRotation, FRONT_ROT } from "../../utils/camera";
import type { Face } from "../../utils/cube";
import { useDefaultView, useAppData } from "../../contexts/AppDataContext";
import { tokensOf } from "../../utils/scheme";
import { EASE_OUT, isTypingTarget } from "../../utils/keyboard";
import { normalizeLabel } from "../../../domain/letterPairs/identity";

// A sentinel lets software keyboards delete the preceding answer from an empty token.
const EMPTY = "\u200b";
export function RecognitionWorkspace({
  t,
  stage,
}: {
  t: TrainingSession;
  stage: { width: number; height: number };
}) {
  const [value, setValue] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const reduced = useReducedMotion();
  const view = useDefaultView();
  const { setup } = useAppData();
  const single = tokensOf(
    setup.scheme,
    t.filter === "both" ? undefined : t.filter === "edges" ? "edge" : "corner",
  ).every((token) => token.length === 1);
  const locked = t.phase !== "active";
  const step =
    t.recognitionSteps[
      Math.min(t.recognitionAnswers.length, t.recognitionSteps.length - 1)
    ];
  const [rotation, setRotation] = useState(() =>
    step
      ? bestRotation(
          recognitionPieceStickers(step.source).map((id) => id[0] as Face),
          view,
        ).rot
      : FRONT_ROT,
  );
  useLayoutEffect(() => {
    if (step)
      setRotation(
        (from) =>
          bestRotation(
            recognitionPieceStickers(step.source).map((id) => id[0] as Face),
            view,
            from,
          ).rot,
      );
  }, [step?.source, view.top, view.front]);
  const submit = useCallback(
    (token: string) => {
      if (!locked && normalizeLabel(token)) {
        t.answerRecognition(token);
        setValue("");
      }
    },
    [locked, t.answerRecognition],
  );
  const backspace = useCallback(() => {
    if (locked) return;
    if (value) setValue((v) => [...v].slice(0, -1).join(""));
    else t.undoRecognition();
  }, [locked, value, t.undoRecognition]);
  const handleKey = useCallback(
    (e: KeyboardEvent | React.KeyboardEvent) => {
      if (e.repeat) {
        e.preventDefault();
        return;
      }
      if (
        locked ||
        e.defaultPrevented ||
        ("isComposing" in e && e.isComposing) ||
        ("nativeEvent" in e && e.nativeEvent.isComposing) ||
        e.keyCode === 229 ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey ||
        e.repeat
      )
        return;
      if (e.key === "Backspace") {
        e.preventDefault();
        backspace();
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (!single) submit(value);
      } else if (e.key.length === 1 && normalizeLabel(e.key)) {
        e.preventDefault();
        if (single) submit(e.key);
        else setValue((v) => normalizeLabel(v + e.key).slice(0, 12));
      }
    },
    [locked, backspace, single, submit, value],
  );
  useEffect(() => {
    if (locked) return;
    const onKey = (e: KeyboardEvent) => {
      if (
        !isTypingTarget(e.target) &&
        !document.querySelector('[role="dialog"], [role="alertdialog"]')
      )
        handleKey(e);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [locked, handleKey]);
  if (!step) return null;
  const stickers = recognitionPieceStickers(step.source);
  return (
    <div className="scroll-quiet flex h-full min-h-0 flex-col items-center justify-center gap-5 overflow-y-auto">
      <CompactTrainingTimer
        value={t.elapsed.total}
        phase={locked ? "stopped" : "running"}
        label="Recognition"
      />
      <SchemeCube
        scheme={setup.scheme}
        state={t.challenge.state}
        hideLetters
        size={Math.max(
          130,
          Math.min(340, stage.width - 40, stage.height * 0.55),
        )}
        view={view}
        rotation={rotation}
        animateOrientation
        allowRotation={false}
        mode="static"
        recognitionSource={step.source}
        highlightIds={stickers}
        label="Recognition piece"
      />
      <div className="relative w-full max-w-[380px] px-3">
        <button
          type="button"
          aria-label="Focus recognition typing"
          title="Type an answer. Backspace returns to the previous piece."
          disabled={locked}
          onClick={() => input.current?.focus()}
          className="relative block h-16 w-full cursor-text overflow-hidden rounded-sm outline-none focus-visible:ring-1 focus-visible:ring-line-strong"
        >
          <span
            aria-hidden
            className="absolute inset-y-0 right-1/2 flex w-1/2 items-center justify-end overflow-hidden pr-3"
            style={{
              maskImage: "linear-gradient(to right, transparent, black 45%)",
            }}
          >
            <span className="flex items-center gap-3 font-mono text-[28px] leading-none text-ink-2">
              {t.recognitionAnswers.slice(-12).map((answer, i) => (
                <motion.span
                  key={
                    t.recognitionAnswers.length -
                    Math.min(t.recognitionAnswers.length, 12) +
                    i
                  }
                  layout={!reduced ? "position" : false}
                  initial={{ opacity: 0, x: reduced ? 0 : 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    duration: reduced ? 0 : 0.14,
                    ease: EASE_OUT,
                  }}
                  className="shrink-0"
                >
                  {answer}
                </motion.span>
              ))}
            </span>
          </span>
          <span
            aria-hidden
            className="absolute left-1/2 top-1/2 h-8 w-[2px] -translate-y-1/2 rounded-full bg-accent"
          />
          <span
            aria-hidden
            className="absolute inset-y-0 left-1/2 flex w-1/2 items-center overflow-hidden pl-3 text-left"
          >
            <AnimatePresence initial={false}>
              {value ? (
                <motion.span
                  key="buffer"
                  initial={{ opacity: 0, x: reduced ? 0 : 18 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: reduced ? 0 : -20 }}
                  transition={{ duration: reduced ? 0 : 0.18, ease: EASE_OUT }}
                  className="absolute font-mono text-[28px] text-ink"
                >
                  {value}
                </motion.span>
              ) : t.recognitionAnswers.length === 0 ? (
                <motion.span
                  key="begin"
                  data-recognition-prompt
                  initial={{ opacity: 0, x: reduced ? 0 : 24 }}
                  animate={{ x: 0, opacity: 0.5 }}
                  exit={{ x: reduced ? 0 : -90, opacity: 0 }}
                  transition={{ duration: reduced ? 0 : 0.42, ease: EASE_OUT }}
                  className="absolute whitespace-nowrap font-mono text-[18px] text-ink-3"
                >
                  begin typing
                </motion.span>
              ) : (
                <motion.span
                  key="runway"
                  initial={{ opacity: 0, x: reduced ? 0 : 32 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: reduced ? 0 : 0.32, ease: EASE_OUT }}
                  exit={{ opacity: 0 }}
                  className="relative flex gap-3 overflow-hidden font-mono text-[28px] leading-none text-ink-3"
                >
                  <AnimatePresence initial={false} mode="popLayout">
                    {Array.from(
                      {
                        length: Math.min(
                          5,
                          t.recognitionSteps.length -
                            t.recognitionAnswers.length,
                        ),
                      },
                      (_, i) => t.recognitionAnswers.length + i,
                    ).map((position) => (
                      <motion.span
                        key={position}
                        layout={!reduced ? "position" : false}
                        initial={{ opacity: 0, x: reduced ? 0 : 24 }}
                        animate={{ opacity: 0.18, x: 0 }}
                        exit={{ opacity: 0, x: reduced ? 0 : -24 }}
                        transition={{
                          duration: reduced ? 0 : 0.18,
                          ease: EASE_OUT,
                        }}
                        className="shrink-0"
                      >
                        _
                      </motion.span>
                    ))}
                  </AnimatePresence>
                </motion.span>
              )}
            </AnimatePresence>
          </span>
        </button>
        <div className="relative flex h-6 items-center justify-center text-[11px] text-ink-3">
          <span data-recognition-progress className="font-mono tnum opacity-60">
            {Math.min(
              t.recognitionAnswers.length + 1,
              t.recognitionSteps.length,
            )}{" "}
            / {t.recognitionSteps.length}
          </span>
          {!single && value && (
            <span className="absolute left-[calc(50%+44px)] whitespace-nowrap opacity-60">
              enter to submit
            </span>
          )}
        </div>
        <input
          ref={input}
          aria-label="Target label"
          autoFocus
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={13}
          disabled={locked}
          value={value || EMPTY}
          className="absolute bottom-0 left-1/2 h-px w-px text-[16px] opacity-0"
          style={{ boxShadow: "none", outline: "none", border: 0 }}
          onKeyDown={handleKey}
          onChange={(e) => {
            const event = e.nativeEvent as InputEvent;
            if (event.isComposing) return;
            const next = normalizeLabel(e.target.value.replaceAll(EMPTY, ""));
            if (
              event.inputType === "deleteContentBackward" &&
              !value &&
              !next
            ) {
              backspace();
              return;
            }
            if (single && next.length === 1) submit(next);
            else setValue(next.slice(0, 12));
          }}
        />
      </div>
    </div>
  );
}
