export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}

/** Navigation yields Space to Training; action buttons retain native activation. */
export function ownsTrainingSpace(target: EventTarget | null): boolean {
  if (isTypingTarget(target)) return false;
  if (!(target instanceof HTMLElement)) return true;
  const control = target.closest("button, a");
  return (
    !control ||
    !!control.closest('nav, [role="radiogroup"]') ||
    control.getAttribute("aria-label") === "Training controls"
  );
}

export const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1];
export const EASE_DRAWER: [number, number, number, number] = [0.32, 0.72, 0, 1];
