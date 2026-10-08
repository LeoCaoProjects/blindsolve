import React from "react";
import { TrainingSession } from "../../hooks/useTrainingSession";
import { formatTime } from "../../utils/time";
import { fullPairs, trailingTarget } from "../../utils/training";
import { SequenceView } from "../memo/SequenceView";
import { M2ParityNotice } from "../memo/M2ParityNotice";

const LABEL = { corners: "Corners", edges: "Edges" } as const;

/**
 * Timed execution: the clock and the memo, nothing else. No scramble, no cube to glance at.
 * Words mode falls back to the letters for any pair without a saved word.
 */
export function ExecutionWorkspace({ t }: { t: TrainingSession }) {
  const multi = t.groups.length > 1;
  return (
    <div className="scroll-quiet h-full min-h-0 overflow-y-auto py-2 md:pl-14">
      <p
        role="timer"
        aria-live="off"
        className={`tnum font-timer text-[clamp(34px,6.5vh,60px)] font-extralight leading-none tracking-[-0.04em] ${
          t.phase === "active" ? "text-ink-2" : "text-ink-3"
        }`}
      >
        {formatTime(t.elapsed.total)}
      </p>
      <div className="mt-[clamp(18px,4.5vh,44px)] grid gap-[clamp(18px,4.5vh,40px)]">
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
      </div>
      {t.challenge.hasM2Parity && <M2ParityNotice className="mt-5" />}
    </div>
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
