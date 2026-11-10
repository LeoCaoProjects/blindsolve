import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { TrainingSession } from "../../hooks/useTrainingSession";
import { SchemeCube } from "../cube/SchemeCube";
import { CompactTrainingTimer } from "./CompactTrainingTimer";
import { recognitionPieceStickers } from "../../utils/recognition";
import { bestRotation, FRONT_ROT } from "../../utils/camera";
import type { Face } from "../../utils/cube";
import { useDefaultView, useAppData } from "../../contexts/AppDataContext";
import { tokensOf } from "../../utils/scheme";
import { isTypingTarget } from "../../utils/keyboard";
import { normalizeLabel } from "../../../domain/letterPairs/identity";

export function RecognitionWorkspace({
  t,
  stage,
}: {
  t: TrainingSession;
  stage: { width: number; height: number };
}) {
  const [value, setValue] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const view = useDefaultView();
  const { setup } = useAppData();
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
    if (!step) return;
    setRotation(
      (from) =>
        bestRotation(
          recognitionPieceStickers(step.source).map((id) => id[0] as Face),
          view,
          from,
        ).rot,
    );
  }, [step?.source, view.top, view.front]);
  useEffect(() => {
    if (t.phase !== "active") return;
    const onKey = (e: KeyboardEvent) => {
      if (
        isTypingTarget(e.target) ||
        e.defaultPrevented ||
        e.isComposing ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey ||
        e.repeat ||
        document.querySelector('[role="dialog"], [role="alertdialog"]')
      )
        return;
      const singleKey = tokensOf(
        setup.scheme,
        t.filter === "both"
          ? undefined
          : t.filter === "edges"
            ? "edge"
            : "corner",
      ).every((token) => token.length === 1);
      if (e.key.length === 1 && normalizeLabel(e.key)) {
        e.preventDefault();
        if (singleKey) t.answerRecognition(e.key);
        else {
          setValue((v) => normalizeLabel(v + e.key).slice(0, 12));
          input.current?.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [t.phase, t.filter, t.answerRecognition, setup.scheme]);
  if (!step) return null;
  const stickers = recognitionPieceStickers(step.source);
  const single = tokensOf(
    setup.scheme,
    t.filter === "both" ? undefined : t.filter === "edges" ? "edge" : "corner",
  ).every((token) => token.length === 1);
  const locked = t.phase !== "active";
  const submit = (token: string) => {
    if (!locked && normalizeLabel(token)) {
      t.answerRecognition(token);
      setValue("");
    }
  };
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
          Math.min(340, stage.width - 40, stage.height * 0.58),
        )}
        view={view}
        rotation={rotation}
        animateOrientation
        allowRotation={false}
        mode="static"
        selected={step.source}
        highlightIds={stickers}
        highlightPrimaryCount={0}
        label="Recognition piece"
      />
      <form
        className="relative flex min-h-[72px] w-full max-w-[280px] flex-col items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit(value);
        }}
      >
        <button
          type="button"
          onClick={() => input.current?.focus()}
          disabled={locked}
          className="text-[13px] text-ink-3 transition-colors hover:text-ink-2"
        >
          {single ? "Type the target letter" : "Type the target, then Enter"}
        </button>
        <span
          data-recognition-progress
          className="font-mono text-[12px] text-ink-3 tnum"
        >
          {Math.min(t.recognitionAnswers.length + 1, t.recognitionSteps.length)}
          /{t.recognitionSteps.length}
        </span>
        <input
          ref={input}
          aria-label="Target label"
          autoFocus
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={12}
          style={{ boxShadow: "none", outline: "none", border: 0 }}
          disabled={locked}
          value={value}
          className={
            single
              ? "absolute bottom-0 h-px w-px text-[16px] opacity-0"
              : "h-8 w-full border-0 bg-transparent text-center font-mono text-[20px] text-ink outline-none"
          }
          onKeyDown={(e) => {
            if (
              e.nativeEvent.isComposing ||
              e.key === "Process" ||
              e.keyCode === 229 ||
              e.metaKey ||
              e.ctrlKey ||
              e.altKey ||
              e.repeat
            ) {
              if (!e.metaKey && !e.ctrlKey && !e.altKey) e.preventDefault();
              return;
            }
            if (e.key === "Enter") {
              e.preventDefault();
              submit(value);
            }
          }}
          onChange={(e) => {
            if ((e.nativeEvent as InputEvent).isComposing) return;
            const next = normalizeLabel(e.target.value);
            if (single && next.length === 1) submit(next);
            else setValue(next);
          }}
        />
      </form>
    </div>
  );
}
