import React from "react";

/** Method metadata only: parity never changes the traced physical targets. */
export function M2ParityNotice({ className = "" }: { className?: string }) {
  return (
    <p className={`text-[12px] text-accent ${className}`}>
      M2 parity · apply your corner-method parity case
    </p>
  );
}
