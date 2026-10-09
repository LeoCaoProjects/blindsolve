import type { LetteringScheme, TraceSection, TraceTarget } from "./types";
import {
  canonicalEdgeStickerToMethodId,
  inferM2OrientationFromBuffer,
  methodRelativeEdgeStickerId,
  type CubeOrientation,
} from "./orientation";

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
  orientation: CubeOrientation = { up: "U", front: "F" },
): readonly [string, string] {
  if (index % 2 === 0) return [face, adjacentFace];
  const canonicalPiece = [face, adjacentFace].join("");
  const methodId = canonicalEdgeStickerToMethodId(
    `${face}:${canonicalPiece}`,
    orientation,
  );
  if (!methodId) return [face, adjacentFace];
  const methodFace = methodId[0];
  const methodAdjacent = [...methodId.slice(2)].find((f) => f !== methodFace);
  if (!methodAdjacent) return [face, adjacentFace];
  const mapped = M2_SECOND_TARGET_FACE_PAIRS[`${methodFace}${methodAdjacent}`];
  if (!mapped) return [face, adjacentFace];
  const canonicalId = methodRelativeEdgeStickerId(
    `${mapped[0]}:${mapped[0]}${mapped[1]}`,
    orientation,
  );
  if (!canonicalId) return [face, adjacentFace];
  const mappedFace = canonicalId[0];
  const mappedAdjacent = [...canonicalId.slice(2)].find((f) => f !== mappedFace);
  return mappedAdjacent ? [mappedFace, mappedAdjacent] : [face, adjacentFace];
}

export function m2SecondTargetStickerId(
  stickerId: string,
  index: number,
  orientation: CubeOrientation = { up: "U", front: "F" },
) {
  if (index % 2 === 0) return stickerId;
  const methodId = canonicalEdgeStickerToMethodId(stickerId, orientation);
  const mappedMethodId = methodId
    ? (M2_SECOND_TARGET_OPPOSITES[methodId] ?? methodId)
    : null;
  return mappedMethodId
    ? (methodRelativeEdgeStickerId(mappedMethodId, orientation) ?? stickerId)
    : stickerId;
}

export function isClassicM2Configuration(scheme: LetteringScheme) {
  return (
    scheme.edgeMethod === "m2" &&
    inferM2OrientationFromBuffer(scheme.edgeBuffer) !== null
  );
}

export function m2SecondTarget(
  target: TraceTarget,
  index: number,
  scheme: LetteringScheme,
): TraceTarget {
  if (index % 2 === 0) return target;
  const orientation = inferM2OrientationFromBuffer(scheme.edgeBuffer);
  if (!orientation) return target;
  const stickerId = m2SecondTargetStickerId(target.stickerId, index, orientation);
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
      transformEnabled && isClassicM2Configuration(scheme)
        ? applyM2SecondTargetSwap(section, scheme).targets
        : [...section.targets],
    hasM2Parity: isClassicM2Configuration(scheme) && m2NeedsParity(section),
  };
}
