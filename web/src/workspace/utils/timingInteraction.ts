/** Timing surfaces accept direct touch/pen only. Mouse includes trackpads.
 * Deliberate buttons retain their normal click behavior. */
export function isTimingPointer(event: {
  pointerType: string;
  button: number;
  isPrimary?: boolean;
  target: EventTarget | null;
}) {
  return (
    (event.pointerType === "touch" || event.pointerType === "pen") &&
    event.button === 0 &&
    event.isPrimary !== false &&
    !(
      event.target instanceof Element &&
      event.target.closest(
        'button, a, input, textarea, select, [contenteditable="true"], [role="button"]',
      )
    )
  );
}
export type TimingVisual = "idle" | "holding" | "running";
export function timingVisual(phase: string, running: boolean): TimingVisual {
  return phase === "armed" || phase === "ready"
    ? "holding"
    : running
      ? "running"
      : "idle";
}
export const timingClass = (state: TimingVisual) =>
  `timing-recede timing-${state}`;
