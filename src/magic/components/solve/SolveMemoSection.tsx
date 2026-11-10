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
  showScramble = true,
}: {
  scramble: string;
  showScramble?: boolean;
  memo: SolveMemo;
  db: LetterPairDb;
  size?: "md" | "lg";
  renderWord?: (pair: string, piece: Piece, word: string) => React.ReactNode;
}) {
  return (
    <div data-solve-memo-section>
      {showScramble && (
        <ScrambleText
          scramble={scramble}
          animate={false}
          className="text-[15px] leading-[1.75] text-ink"
        />
      )}
      <div
        data-solve-memo
        className={showScramble ? "mt-8 border-t border-line pt-7" : undefined}
      >
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
