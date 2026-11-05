import React from "react";
import { Decision, Reconstruction } from "../../hooks/useReconstruction";
import { Piece } from "../../types/solve";
import { MemoTrace } from "../solve/MemoTrace";
import { EditableWord } from "./EditableWord";
import { useAppData } from "../../contexts/AppDataContext";

interface ReviewMemoProps {
  r: Reconstruction;
  size?: "md" | "lg";
}

export function ReviewMemo({ r, size = "md" }: ReviewMemoProps) {
  const { prefs } = useAppData();
  const rowsByPiece: Record<
    Piece,
    { piece: Piece; label: string; pairs: string[]; breakAt?: number }
  > = {
    corners: {
      piece: "corners",
      label: "Corners",
      pairs: r.sample.corners,
      breakAt: r.sample.cornerBreak?.at,
    },
    edges: {
      piece: "edges",
      label: "Edges",
      pairs: r.sample.edges,
      breakAt: r.sample.edgeBreak?.at,
    },
  };
  const rows = (
    prefs.memoOrder === "edges-first"
      ? ["edges", "corners"]
      : ["corners", "edges"]
  )
    .map((piece) => rowsByPiece[piece as Piece])
    .filter((row) => row.pairs.length > 0);

  return (
    <div>
      <div className="grid gap-8">
        {rows.map((row) => (
          <section
            key={row.piece}
            className="grid grid-cols-[72px_1fr] items-start gap-4"
          >
            <h3 className="pt-1 text-[12px] text-ink-3">{row.label}</h3>
            <MemoTrace
              size={size === "lg" ? "lg" : "md"}
              pairs={row.pairs}
              breakAt={row.breakAt ?? null}
              renderWord={(pair) => (
                <EditableWord
                  pair={pair}
                  value={r.wordFor(pair, row.piece)}
                  isNew={r.isNew(pair, row.piece)}
                  onCommit={(w) => r.setWord(pair, row.piece, w)}
                />
              )}
            />
          </section>
        ))}
      </div>

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

      {r.newPairs.length > 0 && (
        <p className="mt-7 text-[12.5px] text-ink-3">
          <span className="text-accent">+</span>{" "}
          {r.newPairs.map(({ pair, piece }, i) => (
            <span key={`${piece}:${pair}`}>
              <span className="font-mono tracking-[0.1em] text-ink-2">
                {pair}
              </span>{" "}
              {r.wordFor(pair, piece)}
              {i < r.newPairs.length - 1 ? ", " : ""}
            </span>
          ))}{" "}
          join your letter pairs
        </p>
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
    { value: "replace", label: `Use ${used}` },
    { value: "alternate", label: "Add as alternate" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px]">
      <span className="font-mono tracking-[0.12em] text-ink">{pair}</span>
      <span className="text-ink-3">
        {stored} <span aria-hidden>→</span>
        <span className="sr-only">changed to</span>{" "}
        <span className="text-ink">{used}</span>
      </span>
      <div
        role="radiogroup"
        aria-label={`Letter pair ${pair}`}
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
