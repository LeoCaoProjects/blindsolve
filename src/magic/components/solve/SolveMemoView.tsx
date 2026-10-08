import React from "react";
import { LetterPairDb, Piece, SolveMemo } from "../../types/solve";
import { MemoTrace } from "./MemoTrace";
import { useAppData } from "../../contexts/AppDataContext";
import { M2ParityNotice } from "../memo/M2ParityNotice";

interface SolveMemoViewProps {
  memo: SolveMemo;
  db: LetterPairDb;
  size?: "sm" | "md" | "lg";
  className?: string;
  labelWidth?: string;
}

/** The words used in THAT solve — with a quiet note where the database has since moved on. */
export function SolveMemoView({
  memo,
  db,
  size = "md",
  className = "",
  labelWidth = "72px",
}: SolveMemoViewProps) {
  const { prefs } = useAppData();
  const rowsByPiece = {
    corners: {
      label: "Corners",
      pairs: memo.corners,
      breakAt: memo.cornerBreakAt,
    },
    edges: { label: "Edges", pairs: memo.edges, breakAt: memo.edgeBreakAt },
  };
  const order: Piece[] =
    prefs.memoOrder === "edges-first"
      ? ["edges", "corners"]
      : ["corners", "edges"];
  const rows = order.map((piece) => rowsByPiece[piece]);

  return (
    <div className={`grid gap-7 ${className}`}>
      {rows.map((row) =>
        row.pairs.length ? (
          <section
            key={row.label}
            className="grid items-start gap-4"
            style={{ gridTemplateColumns: `${labelWidth} 1fr` }}
          >
            <h3 className="pt-0.5 text-[12px] text-ink-3">{row.label}</h3>
            <MemoTrace
              size={size}
              pairs={row.pairs.map((p) => p.pair)}
              breakAt={row.breakAt ?? null}
              renderWord={(pair, i) => {
                const used = row.pairs[i].word;
                const current = db[pair]?.[0];
                return (
                  <span className="flex flex-col">
                    <span className="truncate">
                      {used || <span className="text-ink-3">—</span>}
                    </span>
                    {current &&
                      used &&
                      current.toLowerCase() !== used.toLowerCase() && (
                        <span className="truncate text-[11px] text-ink-3">
                          now {current}
                        </span>
                      )}
                  </span>
                );
              }}
            />
          </section>
        ) : null,
      )}
      {memo.targetRepresentation === "m2-execution" && (
        <p className="text-[12px] text-ink-3">M2 execution targets</p>
      )}
      {memo.hasM2Parity && <M2ParityNotice />}
    </div>
  );
}
