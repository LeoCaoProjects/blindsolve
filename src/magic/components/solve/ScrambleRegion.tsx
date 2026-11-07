import React from "react";

/** Reserve the wrapping geometry of a full scramble in every asynchronous state.
 * JetBrains Mono's advance is 0.6em: 2.22em preserves the original 3.7ch slot
 * without letting a temporary fallback font change the reserved row count. */
export function ScrambleRegion({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-w-0 flex-1 font-mono text-[clamp(15px,1.45vw,20px)] leading-[1.75]">
      <p
        aria-hidden
        className="invisible col-start-1 row-start-1 flex flex-wrap select-none"
      >
        {Array.from({ length: 30 }, (_, i) => (
          <span key={i} className="inline-block w-[2.22em]">
            R
          </span>
        ))}
      </p>
      <div className="col-start-1 row-start-1 min-w-0">{children}</div>
    </div>
  );
}
