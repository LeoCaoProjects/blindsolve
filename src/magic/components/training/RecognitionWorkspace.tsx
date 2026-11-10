import React, { useState } from "react";
import type { TrainingSession } from "../../hooks/useTrainingSession";
import { Cube3D } from "../cube/Cube3D";
import { CompactTrainingTimer } from "./CompactTrainingTimer";
import { recognitionPieceStickers } from "../../utils/recognition";
import { bestRotation } from "../../utils/camera";
import type { Face } from "../../utils/cube";
import { useDefaultView, useAppData } from "../../contexts/AppDataContext";
import { tokensOf } from "../../utils/scheme";
import { normalizeLabel } from "../../../domain/letterPairs/identity";

export function RecognitionWorkspace({
  t,
  stage,
}: {
  t: TrainingSession;
  stage: { width: number; height: number };
}) {
  const [value, setValue] = useState("");
  const view = useDefaultView();
  const { setup } = useAppData();
  const step =
    t.recognitionSteps[
      Math.min(t.recognitionAnswers.length, t.recognitionSteps.length - 1)
    ];
  if (!step) return null;
  const stickers = recognitionPieceStickers(step.source);
  const rotation = bestRotation(
    stickers.map((id) => id[0] as Face),
    view,
  ).rot;
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
      <Cube3D
        state={t.challenge.state}
        size={Math.max(
          130,
          Math.min(340, stage.width - 40, stage.height * 0.58),
        )}
        view={view}
        rotation={rotation}
        observation={{ source: step.source, stickers }}
        label="Recognition piece"
      />
      <form
        className="w-full max-w-[280px]"
        onSubmit={(e) => {
          e.preventDefault();
          submit(value);
        }}
      >
        <label className="text-[12px] text-ink-3" htmlFor="recognition-answer">
          {step.piece === "edges" ? "Edge" : "Corner"} ·{" "}
          {Math.min(t.recognitionAnswers.length + 1, t.recognitionSteps.length)}
          /{t.recognitionSteps.length}
        </label>
        <input
          id="recognition-answer"
          aria-label="Target label"
          autoFocus
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={12}
          disabled={locked}
          value={value}
          className="mt-2 h-11 w-full border-b border-line bg-transparent font-mono text-[24px] text-ink outline-none focus:border-ink"
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
        {!single && (
          <span className="mt-2 block text-[12px] text-ink-3">
            Enter to submit
          </span>
        )}
      </form>
    </div>
  );
}
