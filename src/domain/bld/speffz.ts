import type { LetteringScheme, PieceType, StickerDefinition } from "./types";

export const EDGE_PIECES = [
  "UF",
  "UR",
  "UB",
  "UL",
  "DF",
  "DR",
  "DB",
  "DL",
  "FR",
  "FL",
  "BR",
  "BL",
] as const;
export const CORNER_PIECES = [
  "UFR",
  "URB",
  "UBL",
  "ULF",
  "DFR",
  "DFL",
  "DLB",
  "DBR",
] as const;
// Verified against cubing.js 3x3 SVG CORNERS-l{piece}-o{orientation} facelets.
const CORNER_ORIENTATION_FACES = [
  "URF",
  "UBR",
  "ULB",
  "UFL",
  "DFR",
  "DLF",
  "DBL",
  "DRB",
];

// Speffz is assigned clockwise on U, L, F, R, B, D faces.
const EDGE_FACE_ORDER: Record<string, string[]> = {
  U: ["UB", "UR", "UF", "UL"],
  L: ["UL", "FL", "DL", "BL"],
  F: ["UF", "FR", "DF", "FL"],
  R: ["UR", "BR", "DR", "FR"],
  B: ["UB", "BL", "DB", "BR"],
  D: ["DF", "DR", "DB", "DL"],
};
const CORNER_FACE_ORDER: Record<string, string[]> = {
  U: ["UBL", "URB", "UFR", "ULF"],
  L: ["UBL", "ULF", "DFL", "DLB"],
  F: ["ULF", "UFR", "DFR", "DFL"],
  R: ["UFR", "URB", "DBR", "DFR"],
  B: ["URB", "UBL", "DLB", "DBR"],
  D: ["DFL", "DFR", "DBR", "DLB"],
};

function makeStickers(
  pieceType: PieceType,
  pieces: readonly string[],
  order: Record<string, string[]>,
) {
  const stickers: Record<string, StickerDefinition> = {};
  let code = 65;
  for (const face of ["U", "L", "F", "R", "B", "D"]) {
    for (const pieceName of order[face]) {
      const pieceIndex = pieces.indexOf(pieceName);
      const orientationIndex = (
        pieceType === "corner"
          ? CORNER_ORIENTATION_FACES[pieceIndex]
          : pieceName
      ).indexOf(face);
      const id = `${face}:${pieceName}`;
      stickers[id] = {
        id,
        pieceType,
        pieceIndex,
        orientationIndex,
        face,
        label: String.fromCharCode(code++),
      };
    }
  }
  return stickers;
}

export function createSpeffzScheme(): LetteringScheme {
  return {
    id: "speffz-default",
    name: "Speffz",
    orientation: { up: "U", front: "F" },
    edgeBuffer: "D:DF",
    cornerBuffer: "L:UBL",
    edgeMethod: "m2",
    cornerMethod: "old-pochmann",
    stickers: {
      ...makeStickers("edge", EDGE_PIECES, EDGE_FACE_ORDER),
      ...makeStickers("corner", CORNER_PIECES, CORNER_FACE_ORDER),
    },
  };
}

export function stickersFor(scheme: LetteringScheme, type: PieceType) {
  return Object.values(scheme.stickers).filter((s) => s.pieceType === type);
}

export function findSticker(
  scheme: LetteringScheme,
  type: PieceType,
  pieceIndex: number,
  orientationIndex: number,
) {
  return stickersFor(scheme, type).find(
    (s) =>
      s.pieceIndex === pieceIndex && s.orientationIndex === orientationIndex,
  );
}
