import type { Solve } from "../../types/solve";
import type { TimerMode } from "../../utils/timerModes";
import { MemoTrace } from "../solve/MemoTrace";

export function TimerMemoFooter({
  latest,
  mode,
  memoOrder,
  className = "",
}: {
  latest: Solve | null;
  mode: TimerMode;
  memoOrder: "edges-first" | "corners-first";
  className?: string;
}) {
  const order =
    memoOrder === "edges-first"
      ? (["edges", "corners"] as const)
      : (["corners", "edges"] as const);
  const pieces = order.filter((piece) => mode === "3bld" || mode === piece);
  const hasMemo =
    latest && pieces.some((piece) => latest.memo[piece].length > 0);
  return (
    <section
      aria-label="Last solve memo"
      className={`timer-workspace-inset flex h-28 shrink-0 flex-col border-t border-line py-4 transition-opacity duration-200 md:h-32 md:py-6 ${className}`}
    >
      <h2 className="mb-2 shrink-0 text-[12px] font-medium leading-4 text-ink-2">
        Last memo
      </h2>
      <div
        tabIndex={hasMemo ? 0 : undefined}
        aria-label="Previous memo content"
        className="scroll-quiet min-h-0 flex-1 overflow-y-auto overscroll-contain focus-visible:outline focus-visible:outline-1 focus-visible:outline-accent"
      >
        {hasMemo ? (
          <div className="flex flex-wrap items-start gap-x-8 gap-y-3">
            {pieces
              .filter((piece) => latest.memo[piece].length > 0)
              .map((piece) => {
                const memo = latest.memo[piece];
                return (
                  <section
                    key={piece}
                    aria-label={`Previous ${piece} memo`}
                    className="min-w-0 max-w-full"
                  >
                    <h3 className="mb-1 text-[10.5px] leading-3 text-ink-3">
                      {piece === "edges" ? "Edges" : "Corners"}
                    </h3>
                    <MemoTrace
                      size="sm"
                      pairs={memo.map((pair) => pair.pair)}
                      words={memo.map((pair) => pair.word)}
                      breakAt={
                        (piece === "edges"
                          ? latest.memo.edgeBreakAt
                          : latest.memo.cornerBreakAt) ?? null
                      }
                    />
                  </section>
                );
              })}
          </div>
        ) : (
          <span
            aria-label="No previous memo"
            className="text-[13px] text-ink-3"
          >
            —
          </span>
        )}
      </div>
    </section>
  );
}
