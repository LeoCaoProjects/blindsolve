import { useEffect, useRef } from "react";
import { MemoTrace } from "../solve/MemoTrace";
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
      className={`timer-workspace-inset flex h-20 min-h-20 max-h-20 shrink-0 items-center overflow-hidden border-t border-line py-2 transition-opacity duration-200 ${className}`}
    >
      <div
        ref={content}
        tabIndex={pieces.length ? 0 : undefined}
        aria-label="Previous memo content"
        className="scroll-quiet min-w-0 flex-1 overflow-x-auto overflow-y-hidden overscroll-x-contain py-0.5 focus-visible:outline focus-visible:outline-1 focus-visible:outline-accent"
      >
        {latest && pieces.length ? (
          <div className="flex w-max flex-nowrap items-start gap-8">
            {pieces.map((piece) => (
              <section
                key={piece}
                aria-label={`Previous ${piece} memo`}
                className="shrink-0"
              >
                <h3 className="mb-1 text-[10.5px] leading-3 text-ink-3">
                  {piece === "edges" ? "Edges" : "Corners"}
                </h3>
                <MemoTrace
                  size="sm"
                  nowrap
                  pairs={latest.memo[piece].map((pair) => pair.pair)}
                  words={latest.memo[piece].map((pair) => pair.word)}
                  breakAt={
                    (piece === "edges"
                      ? latest.memo.edgeBreakAt
                      : latest.memo.cornerBreakAt) ?? null
                  }
                />
              </section>
            ))}
          </div>
        ) : (
          <span
            aria-label="No previous memo"
            className="text-[12px] text-ink-3"
          >
            {"\u2014"}
          </span>
        )}
      </div>
    </section>
  );
}
