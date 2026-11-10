import type { Challenge, TrainFilter } from "./bld";
import { homeSticker } from "./bld";
import { ALL_STICKERS } from "./scheme";
import { normalizeLabel } from "../../domain/letterPairs/identity";

export interface RecognitionStep {
  source: string;
  piece: "edges" | "corners";
  expected: string;
}
/** Follow structured raw trace identities on the unchanged scrambled cube.
 * Break entries are choices, not observations; their location starts the next chain.
 */
export function recognitionSteps(
  challenge: Challenge,
  buffers: { edgeBuffer: string; cornerBuffer: string },
  order: "corners-first" | "edges-first",
  scope: TrainFilter,
): RecognitionStep[] {
  const pieces =
    order === "edges-first"
      ? (["edges", "corners"] as const)
      : (["corners", "edges"] as const);
  return pieces.flatMap((piece) => {
    if (scope !== "both" && scope !== piece) return [];
    const section = challenge.rawTargets[piece];
    const breaks =
      piece === "edges" ? challenge.edgeBreaks : challenge.cornerBreaks;
    let source = piece === "edges" ? buffers.edgeBuffer : buffers.cornerBuffer;
    return section.physicalStickerIds.flatMap((target, index) => {
      const location = source;
      source = target;
      if (breaks.includes(index)) return [];
      if (homeSticker(challenge.state, location) !== target)
        throw new Error("Recognition observation does not match raw trace");
      return [
        {
          source: location,
          piece,
          expected: normalizeLabel(section.tokens[index]),
        },
      ];
    });
  });
}
export function recognitionPieceStickers(source: string) {
  const slot = ALL_STICKERS.find((s) => s.id === source);
  return slot
    ? ALL_STICKERS.filter(
        (s) =>
          s.type === slot.type &&
          [...s.piece].sort().join("") === [...slot.piece].sort().join(""),
      ).map((s) => s.id)
    : [];
}
