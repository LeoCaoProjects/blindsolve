import type { LetteringScheme, TraceSection, TraceTarget } from "./types";

/**
 * Classic target-by-target M2 leaves the M slice displaced after an odd target.
 * Consequently the physical UF/DB stickers exchange roles for every second
 * target.  These are physical IDs, deliberately independent of lettering.
 */
const M2_SECOND_TARGET_OPPOSITES: Record<string, string> = {
  "U:UF": "D:DB",
  "D:DB": "U:UF",
  "F:UF": "B:DB",
  "B:DB": "F:UF",
};

export function m2SecondTargetStickerId(stickerId: string, index: number) {
  return index % 2 === 1 ? (M2_SECOND_TARGET_OPPOSITES[stickerId] ?? stickerId) : stickerId;
}

export function m2SecondTarget(
  target: TraceTarget,
  index: number,
  scheme: LetteringScheme,
): TraceTarget {
  if (index % 2 === 0) return target;
  const stickerId = m2SecondTargetStickerId(target.stickerId, index);
  const sticker = stickerId ? scheme.stickers[stickerId] : undefined;
  return sticker
    ? { ...target, stickerId, pieceIndex: sticker.pieceIndex, token: sticker.label }
    : target;
}

/** Presentation/execution convention only; the raw trace remains unchanged. */
export function applyM2SecondTargetSwap(
  section: TraceSection,
  scheme: LetteringScheme,
): TraceSection {
  return {
    ...section,
    targets: section.targets.map((target, index) =>
      m2SecondTarget(target, index, scheme),
    ),
  };
}
