import type { ReactNode } from "react";

/** Aa and Timer mode are real text, with exactly the same typography. */
export function CubeUtilityLabel({ children }: { children: ReactNode }) {
  return (
    <span className="cube-utility-label font-sans text-[10px] font-normal leading-none">
      {children}
    </span>
  );
}
