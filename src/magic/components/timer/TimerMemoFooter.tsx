import { useEffect, useRef } from "react";
import type { Solve } from "../../types/solve";
import type { TimerMode } from "../../utils/timerModes";

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
  const content = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = content.current;
    if (!element) return;
    // Preserve native trackpad/Shift-wheel scrolling. A plain wheel also
    // advances the strip, without trapping the wheel at its ends.
    const wheel = (event: WheelEvent) => {
      if (
        event.ctrlKey ||
        event.shiftKey ||
        Math.abs(event.deltaX) >= Math.abs(event.deltaY)
      )
        return;
      const delta =
        event.deltaY *
        (event.deltaMode === 1
          ? 16
          : event.deltaMode === 2
            ? element.clientWidth
            : 1);
      const next = Math.max(
        0,
        Math.min(
          element.scrollWidth - element.clientWidth,
          element.scrollLeft + delta,
        ),
      );
      if (next === element.scrollLeft) return;
      event.preventDefault();
      element.scrollLeft = next;
    };
    element.addEventListener("wheel", wheel, { passive: false });
    return () => element.removeEventListener("wheel", wheel);
  }, []);
  const order =
    memoOrder === "edges-first"
      ? (["edges", "corners"] as const)
      : (["corners", "edges"] as const);
  const pieces = order.filter(
    (piece) =>
      (mode === "3bld" || mode === piece) && latest?.memo[piece].length,
  );
  return (
    <section
      aria-label="Last solve memo"
      className={`timer-workspace-inset flex h-20 min-h-20 max-h-20 shrink-0 items-center gap-5 overflow-hidden border-t border-line py-3 transition-opacity duration-200 ${className}`}
    >
      <h2 className="shrink-0 whitespace-nowrap text-[11.5px] font-medium text-ink-2">
        Last memo
      </h2>
      <div
        ref={content}
        tabIndex={pieces.length ? 0 : undefined}
        aria-label="Previous memo content"
        className="scroll-quiet min-w-0 flex-1 overflow-x-auto overflow-y-hidden overscroll-x-contain py-2 focus-visible:outline focus-visible:outline-1 focus-visible:outline-accent"
      >
        {latest && pieces.length ? (
          <div className="flex w-max flex-nowrap items-center gap-4 whitespace-nowrap">
            {pieces.map((piece, groupIndex) => {
              const memo = latest.memo[piece];
              const breakAt =
                (piece === "edges"
                  ? latest.memo.edgeBreakAt
                  : latest.memo.cornerBreakAt) ?? null;
              return (
                <section
                  key={piece}
                  aria-label={`Previous ${piece} memo`}
                  className={`flex shrink-0 items-center gap-3 ${groupIndex ? "border-l border-line-strong pl-4" : ""}`}
                >
                  <h3 className="text-[10.5px] text-ink-3">
                    {piece === "edges" ? "Edges" : "Corners"}
                  </h3>
                  <ol className="flex flex-nowrap items-center gap-4">
                    {memo.map((pair, i) => (
                      <li
                        key={i}
                        className="flex shrink-0 items-baseline gap-1.5 whitespace-nowrap"
                      >
                        <span className="font-mono text-[13px] leading-5 tracking-[0.14em] text-ink">
                          {pair.pair.split("").map((letter, j) => (
                            <span key={j} className="relative">
                              {breakAt === i * 2 + j && (
                                <>
                                  <span
                                    aria-hidden
                                    className="absolute -left-[0.2em] top-[-12%] h-[124%] w-px bg-accent"
                                  />
                                  <span className="sr-only">
                                    cycle break at{" "}
                                  </span>
                                </>
                              )}
                              {letter}
                            </span>
                          ))}
                        </span>
                        {pair.word && (
                          <span className="text-[11.5px] leading-5 text-ink-2">
                            {pair.word}
                          </span>
                        )}
                      </li>
                    ))}
                  </ol>
                </section>
              );
            })}
          </div>
        ) : (
          <span
            aria-label="No previous memo"
            className="whitespace-nowrap text-[12px] text-ink-3"
          >
            No previous memo
          </span>
        )}
      </div>
    </section>
  );
}
