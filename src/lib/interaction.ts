export function typingTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (!!target.closest(
      'input,textarea,select,[contenteditable="true"],dialog',
    ) ||
      !!target.isContentEditable)
  );
}
export function formatTime(ms: number) {
  const seconds = Math.max(0, ms) / 1000;
  return seconds >= 60
    ? `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(2).padStart(5, "0")}`
    : seconds.toFixed(2);
}
export function randomIndex(length: number, random = Math.random) {
  if (length < 1) throw new Error("No cards available");
  return Math.floor(random() * length);
}
