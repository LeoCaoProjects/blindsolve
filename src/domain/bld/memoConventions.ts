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

const M2_SECOND_TARGET_FACE_PAIRS: Record<string, readonly [string, string]> = {
  UF: ["D", "B"],
  DB: ["U", "F"],
  FU: ["B", "D"],
  BD: ["F", "U"],
};

/**
 * Shared physical mapping for adapters whose sticker IDs are not the domain IDs.
 * `adjacentFace` is the other colour/face on the edge, so FU means the F sticker
 * of the UF piece. Letter tokens never participate in this operation.
 */
export function m2SecondTargetFacePair(
  face: string,
  adjacentFace: string,
  index: number,
): readonly [string, string] {
  if (index % 2 === 0) return [face, adjacentFace];
  return (
    M2_SECOND_TARGET_FACE_PAIRS[`${face}${adjacentFace}`] ?? [
      face,
      adjacentFace,
    ]
  );
}

export function m2SecondTargetStickerId(stickerId: string, index: number) {
  return index % 2 === 1
    ? (M2_SECOND_TARGET_OPPOSITES[stickerId] ?? stickerId)
    : stickerId;
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
    ? {
        ...target,
        stickerId,
        pieceIndex: sticker.pieceIndex,
        token: sticker.label,
      }
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

/** An odd number of target-by-target M2 shots leaves the method parity case. */
export function m2NeedsParity(section: TraceSection) {
  return section.targets.length % 2 === 1;
}

export interface M2ExecutionRepresentation {
  /** Canonical factual trace; this is the original array by design. */
  rawTargets: readonly TraceTarget[];
  /** Presentation-only targets used to select classic M2 execution algorithms. */
  executionTargets: TraceTarget[];
  /** Execution metadata only. It never changes either target array. */
  hasM2Parity: boolean;
}

export function m2ExecutionRepresentation(
  section: TraceSection,
  scheme: LetteringScheme,
  transformEnabled: boolean,
): M2ExecutionRepresentation {
  return {
    rawTargets: section.targets,
    executionTargets:
      transformEnabled && scheme.edgeMethod === "m2"
        ? applyM2SecondTargetSwap(section, scheme).targets
        : [...section.targets],
    hasM2Parity: scheme.edgeMethod === "m2" && m2NeedsParity(section),
  };
}
