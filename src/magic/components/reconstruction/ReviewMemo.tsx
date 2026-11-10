import React from "react";
import { Decision, Reconstruction } from "../../hooks/useReconstruction";
import { SolveMemoSection } from "../solve/SolveMemoSection";
import { DecisionMenu } from "../training/review/DecisionMenu";
import { EditableWord } from "./EditableWord";
import { useAppData } from "../../contexts/AppDataContext";
import {
  memoPairTokens,
  displayMemoPair,
} from "../../../domain/letterPairs/identity";

interface ReviewMemoProps {
  r: Reconstruction;
  size?: "md" | "lg";
}

export function ReviewMemo({ r, size = "md" }: ReviewMemoProps) {
  const { timerDb } = useAppData();
  return (
    <div>
      <SolveMemoSection
        showScramble={false}
        scramble={r.draft.scramble}
        memo={r.reviewMemo}
        db={timerDb}
        size={size}
        renderWord={(pair, piece, word) =>
          memoPairTokens(pair).length < 2 ? (
            <span>{word || "—"}</span>
          ) : (
            <EditableWord
              pair={pair}
              value={word}
              onCommit={(value) => r.setWord(pair, piece, value)}
            />
          )
        }
      />

      {r.changedPairs.length > 0 && (
        <section
          aria-label="Default word updates"
          className="mt-8 border-t border-line pt-5"
        >
          <h3 className="mb-2 text-[12px] text-ink-3">
            Overwrite Default words
          </h3>
          {r.changedPairs.map(({ pair, piece }) => (
            <ChangedRow
              key={`${piece}:${pair}`}
              pair={pair}
              stored={r.storedFor(pair, piece) ?? ""}
              used={r.wordFor(pair, piece)}
              value={r.decisions[`${piece}:${pair}`] ?? "replace"}
              onChange={(d) => r.decide(pair, piece, d)}
            />
          ))}
        </section>
      )}
    </div>
  );
}

function ChangedRow({
  pair,
  stored,
  used,
  value,
  onChange,
}: {
  pair: string;
  stored: string;
  used: string;
  value: Decision;
  onChange: (d: Decision) => void;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-line py-3 last:border-b-0">
      <div className="flex min-w-0 items-center gap-4">
        <span className="shrink-0 font-mono text-[15px] tracking-[0.1em] text-ink">
          {displayMemoPair(pair)}
        </span>
        <div className="min-w-0 text-[13px] leading-relaxed">
          <div className="truncate text-ink-3" title={stored}>
            {stored}
          </div>
          <div className="truncate text-ink" title={used}>
            {used}
          </div>
        </div>
      </div>
      <DecisionMenu
        label={`Default word for ${displayMemoPair(pair)}`}
        value={value}
        safe="replace"
        onChange={onChange}
        options={[
          { value: "keep", short: "Keep Default", label: `Keep ${stored}` },
          {
            value: "replace",
            short: "Save as Default",
            label: `Save ${used} as Default`,
          },
        ]}
      />
    </div>
  );
}
