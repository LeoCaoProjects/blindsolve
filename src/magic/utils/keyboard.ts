export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

export const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1];
export const EASE_DRAWER: [number, number, number, number] = [0.32, 0.72, 0, 1];