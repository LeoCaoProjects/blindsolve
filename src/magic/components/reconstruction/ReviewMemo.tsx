import React from "react";
import { Decision, Reconstruction } from "../../hooks/useReconstruction";
import { SolveMemoSection } from "../solve/SolveMemoSection";
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
        <div className="mt-8 grid gap-3 border-t border-line pt-5">
          {r.changedPairs.map(({ pair, piece }) => (
            <ChangedRow
              key={`${piece}:${pair}`}
              pair={pair}
              stored={r.storedFor(pair, piece) ?? ""}
              used={r.wordFor(pair, piece)}
              value={r.decisions[`${piece}:${pair}`] ?? "keep"}
              onChange={(d) => r.decide(pair, piece, d)}
            />
          ))}
        </div>
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
  const options: { value: Decision; label: string }[] = [
    { value: "keep", label: `Keep ${stored}` },
    { value: "replace", label: `Save ${used} as default` },
  ];

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px]">
      <span className="font-mono tracking-[0.12em] text-ink">
        {displayMemoPair(pair)}
      </span>
      <span className="text-ink-3">
        {stored} <span aria-hidden>→</span>
        <span className="sr-only">changed to</span>{" "}
        <span className="text-ink">{used}</span>
      </span>
      <div
        role="radiogroup"
        aria-label={`Letter pair ${displayMemoPair(pair)}`}
        className="ml-auto flex gap-1"
      >
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
            className={`h-7 max-w-[12rem] truncate rounded-[3px] px-2.5 text-[12.5px] transition-colors duration-150 ease-out ${
              value === o.value
                ? "bg-selected text-ink"
                : "text-ink-3 hover:text-ink-2"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
