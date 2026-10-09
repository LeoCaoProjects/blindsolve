const normals: Record<string, readonly number[]> = {
  U: [0, 1, 0],
  D: [0, -1, 0],
  F: [0, 0, 1],
  B: [0, 0, -1],
  R: [1, 0, 0],
  L: [-1, 0, 0],
};
const opposite: Record<string, string> = {
  U: "D",
  D: "U",
  F: "B",
  B: "F",
  R: "L",
  L: "R",
};
export interface CubeOrientation {
  up: string;
  front: string;
}
/** Physical face colours at spatial slots; right = up × front. Invalid drafts return null. */
export function orientationFaceMap({
  up,
  front,
}: {
  up: string;
  front: string;
}): Record<string, string> | null {
  const u = normals[up],
    f = normals[front];
  if (!u || !f || up === front || opposite[up] === front) return null;
  const r = [
    u[1] * f[2] - u[2] * f[1],
    u[2] * f[0] - u[0] * f[2],
    u[0] * f[1] - u[1] * f[0],
  ];
  const right = Object.keys(normals).find((face) =>
    normals[face].every((v, i) => v === r[i]),
  )!;
  return {
    U: up,
    D: opposite[up],
    F: front,
    B: opposite[front],
    R: right,
    L: opposite[right],
  };
}

const edgePieceForFaces = (a: string, b: string) => {
  const wanted = [a, b].sort().join("");
  return ["UF", "UR", "UB", "UL", "DF", "DR", "DB", "DL", "FR", "FL", "BR", "BL"].find(
    (piece) => [...piece].sort().join("") === wanted,
  );
};

/** Map a method-frame edge sticker (for example FU) to canonical physical coordinates. */
export function methodRelativeEdgeStickerId(
  stickerId: string,
  orientation: CubeOrientation,
): string | null {
  const match = stickerId.match(/^([UDLRFB]):([UDLRFB]{2})$/);
  const faceMap = orientationFaceMap(orientation);
  if (!match || !faceMap) return null;
  const face = faceMap[match[1]];
  const piece = edgePieceForFaces(faceMap[match[2][0]], faceMap[match[2][1]]);
  return piece ? `${face}:${piece}` : null;
}

/** Inverse of methodRelativeEdgeStickerId for canonical raw physical targets. */
export function canonicalEdgeStickerToMethodId(
  stickerId: string,
  orientation: CubeOrientation,
): string | null {
  const match = stickerId.match(/^([UDLRFB]):([UDLRFB]{2})$/);
  const faceMap = orientationFaceMap(orientation);
  if (!match || !faceMap) return null;
  const inverse = Object.fromEntries(
    Object.entries(faceMap).map(([methodFace, canonicalFace]) => [canonicalFace, methodFace]),
  );
  const face = inverse[match[1]];
  const piece = edgePieceForFaces(inverse[match[2][0]], inverse[match[2][1]]);
  return piece ? `${face}:${piece}` : null;
}
