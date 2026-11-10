import React from "react";
import type { LetterPairDb, Piece, SolveMemo } from "../../types/solve";
import { ScrambleText } from "./ScrambleText";
import { SolveMemoView } from "./SolveMemoView";

/** Shared lower section for the reconstruction review and saved solve inspector. */
export function SolveMemoSection({
  scramble,
  memo,
  db,
  size = "md",
  renderWord,
}: {
  scramble: string;
  memo: SolveMemo;
  db: LetterPairDb;
  size?: "md" | "lg";
  renderWord?: (pair: string, piece: Piece, word: string) => React.ReactNode;
}) {
  return (
    <div data-solve-memo-section>
      <ScrambleText
        scramble={scramble}
        animate={false}
        className="text-[15px] leading-[1.75] text-ink"
      />
      <div className="mt-8 border-t border-line pt-7">
        <SolveMemoView
          memo={memo}
          db={db}
          size={size}
          renderWord={renderWord}
        />
      </div>
    </div>
  );
}
