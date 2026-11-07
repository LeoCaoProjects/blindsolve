import React from "react";
import { TrainingSession } from "../../hooks/useTrainingSession";
import { TimerPhaseCue } from "../timer/TimerPhaseCue";
import { TrainingTimedStage } from "./TrainingTimedStage";
import { fullPairs, trailingTarget } from "../../utils/training";
import { SequenceView } from "../memo/SequenceView";

const LABEL = { corners: "Corners", edges: "Edges" } as const;

/**
 * Compact timing and targets inside the shared Training workspace.
 * Words mode falls back to the letters for any pair without a saved word.
 */
export function ExecutionWorkspace({
  t,
  elapsed = t.elapsed.total,
  active = t.phase === "active",
  timerLabel,
}: {
  t: TrainingSession;
  elapsed?: number;
  active?: boolean;
  timerLabel?: string;
}) {
  const multi = t.groups.length > 1;
  return (
    <TrainingTimedStage
      value={elapsed}
      phase={
        active
          ? t.mode === "guided" || t.mode === "recall"
            ? "memo"
            : "running"
          : "stopped"
      }
      label={timerLabel}
      cue={
        t.mode === "guided" || t.mode === "recall" ? (
          <TimerPhaseCue
            phase="memo"
            className="relative mt-3 h-[1.5em] text-[13px]"
          />
        ) : undefined
      }
    >
      {t.groups.map((g) => (
        <section key={g.piece}>
          {multi && (
            <h2 className="mb-3 text-[12px] text-ink-3">{LABEL[g.piece]}</h2>
          )}
          {t.display === "letters" ? (
            <SequenceView tokens={g.tokens} size="xl" />
          ) : (
            <WordSequence
              tokens={g.tokens}
              wordFor={(a, b) => t.wordFor(a, b, g.piece)}
            />
          )}
        </section>
      ))}
    </TrainingTimedStage>
  );
}

function WordSequence({
  tokens,
  wordFor,
}: {
  tokens: string[];
  wordFor: (a: string, b: string) => string | undefined;
}) {
  const pairs = fullPairs(tokens);
  const single = trailingTarget(tokens);
  return (
    <ol
      aria-label="Memo words"
      className="flex flex-wrap items-baseline gap-x-[0.5em] gap-y-[0.35em] text-[clamp(22px,min(3vw,5vh),42px)] leading-tight text-ink"
    >
      {pairs.map(([a, b], i) => {
        const word = wordFor(a, b);
        return (
          <li key={i} className="flex items-baseline gap-[0.5em]">
            {word ? (
              <span>{word}</span>
            ) : (
              <span className="font-mono text-[0.85em] tracking-[0.08em] text-ink-2">
                {a}
                {a.length > 1 || b.length > 1 ? " " : ""}
                {b}
              </span>
            )}
            {(i < pairs.length - 1 || single) && (
              <span aria-hidden className="text-ink-3">
                ·
              </span>
            )}
          </li>
        );
      })}
      {single && (
        <li className="font-mono text-[0.85em] tracking-[0.08em] text-ink-2">
          {single}
        </li>
      )}
    </ol>
  );
}
