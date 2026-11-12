import type { LetterScheme } from "../types/app";
import { tokensOf } from "./scheme";
export function activePairVocabulary(scheme: LetterScheme) {
  const tokens = {
    edges: tokensOf(scheme, "edge"),
    corners: tokensOf(scheme, "corner"),
  };
  const sets = {
    edges: new Set(tokens.edges),
    corners: new Set(tokens.corners),
  };
  const possible = (a: string, b: string, piece?: "edges" | "corners") =>
    a !== b &&
    (piece
      ? sets[piece].has(a) && sets[piece].has(b)
      : (sets.edges.has(a) && sets.edges.has(b)) ||
        (sets.corners.has(a) && sets.corners.has(b)));
  return { tokens, axes: tokensOf(scheme), possible };
}
