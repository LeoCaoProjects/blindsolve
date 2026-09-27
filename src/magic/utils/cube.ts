export type Face = 'U' | 'L' | 'F' | 'R' | 'B' | 'D';
export type PieceType = 'corner' | 'edge';
export type CubeState = Record<Face, Face[]>;

type Vec = [number, number, number];

interface Sticker {
  pos: Vec;
  normal: Vec;
  color: Face;
}

/** Speffz lettering order */
export const FACES: Face[] = ['U', 'L', 'F', 'R', 'B', 'D'];

export const STICKER_COLORS: Record<Face, string> = {
  U: '#ECEAE4',
  D: '#E8C443',
  F: '#2F9658',
  B: '#2D69B7',
  R: '#C73C34',
  L: '#E27A2D'
};

export const STICKER_TEXT: Record<Face, string> = {
  U: '#151412',
  D: '#151412',
  L: '#151412',
  F: '#ffffff',
  B: '#ffffff',
  R: '#ffffff'
};

export const CORNER_SLOTS = [0, 2, 8, 6];
export const EDGE_SLOTS = [1, 5, 7, 3];

const NORMALS: Record<Face, Vec> = {
  U: [0, 1, 0],
  D: [0, -1, 0],
  F: [0, 0, 1],
  B: [0, 0, -1],
  R: [1, 0, 0],
  L: [-1, 0, 0]
};

type MoveDef = {inLayer: (p: Vec, wide: boolean) => boolean;rotate: (v: Vec) => Vec;};

const MOVES: Record<string, MoveDef> = {
  R: { inLayer: (p, w) => w ? p[0] >= 0 : p[0] === 1, rotate: ([x, y, z]) => [x, z, -y] },
  L: { inLayer: (p, w) => w ? p[0] <= 0 : p[0] === -1, rotate: ([x, y, z]) => [x, -z, y] },
  U: { inLayer: (p, w) => w ? p[1] >= 0 : p[1] === 1, rotate: ([x, y, z]) => [-z, y, x] },
  D: { inLayer: (p, w) => w ? p[1] <= 0 : p[1] === -1, rotate: ([x, y, z]) => [z, y, -x] },
  F: { inLayer: (p, w) => w ? p[2] >= 0 : p[2] === 1, rotate: ([x, y, z]) => [y, -x, z] },
  B: { inLayer: (p, w) => w ? p[2] <= 0 : p[2] === -1, rotate: ([x, y, z]) => [-y, x, z] }
};

export function stateFromScramble(scramble: string): CubeState {
  const stickers: Sticker[] = [];
  FACES.forEach((face) => {
    for (let i = 0; i < 9; i++) {
      stickers.push({ pos: slotPosition(face, Math.floor(i / 3), i % 3), normal: NORMALS[face], color: face });
    }
  });

  scramble.
  trim().
  split(/\s+/).
  filter(Boolean).
  forEach((token) => {
    const match = token.match(/^([URFDLB])(w?)(2'|2|')?$/);
    if (!match) return;
    const def = MOVES[match[1]];
    const wide = match[2] === 'w';
    const turns = match[3] === "'" ? 3 : match[3]?.startsWith('2') ? 2 : 1;
    for (let t = 0; t < turns; t++) {
      stickers.forEach((s) => {
        if (def.inLayer(s.pos, wide)) {
          s.pos = def.rotate(s.pos);
          s.normal = def.rotate(s.normal);
        }
      });
    }
  });

  const state = {} as CubeState;
  FACES.forEach((f) => state[f] = new Array<Face>(9).fill(f));
  stickers.forEach((s) => {
    const face = faceFromNormal(s.normal);
    state[face][slotIndex(face, s.pos)] = s.color;
  });
  return state;
}

export function letterFor(face: Face, index: number, type: PieceType): string | null {
  const order = type === 'corner' ? CORNER_SLOTS : EDGE_SLOTS;
  const k = order.indexOf(index);
  if (k === -1) return null;
  return String.fromCharCode(65 + FACES.indexOf(face) * 4 + k);
}

export function slotType(index: number): PieceType | null {
  if (CORNER_SLOTS.includes(index)) return 'corner';
  if (EDGE_SLOTS.includes(index)) return 'edge';
  return null;
}

/**
 * Return the physical sticker occupying a rendered facelet.
 *
 * Lettering belongs to stickers, not locations. A scramble moves the U2
 * sticker away from U2, so a renderer must follow the cubie colours back to
 * that sticker's home face and slot before looking up the user's token.
 */
export function physicalStickerAt(state: CubeState, face: Face, index: number): string | null {
  const type = slotType(index);
  if (!type) return null;

  const location = slotPosition(face, Math.floor(index / 3), index % 3);
  const homePosition: Vec = [0, 0, 0];

  FACES.forEach((side) => {
    const sideIndex = slotIndex(side, location);
    if (
      sideIndex < 0 ||
      slotType(sideIndex) !== type ||
      !slotPosition(side, Math.floor(sideIndex / 3), sideIndex % 3).every((value, axis) => value === location[axis])
    ) return;
    const homeFace = state[side][sideIndex];
    const normal = NORMALS[homeFace];
    homePosition[0] += normal[0];
    homePosition[1] += normal[1];
    homePosition[2] += normal[2];
  });

  const homeFace = state[face][index];
  const homeIndex = slotIndex(homeFace, homePosition);
  return homeIndex >= 0 && slotType(homeIndex) === type ? `${homeFace}${homeIndex}` : null;
}

export function slotPosition(face: Face, r: number, c: number): Vec {
  switch (face) {
    case 'U':
      return [c - 1, 1, r - 1];
    case 'D':
      return [c - 1, -1, 1 - r];
    case 'F':
      return [c - 1, 1 - r, 1];
    case 'B':
      return [1 - c, 1 - r, -1];
    case 'R':
      return [1, 1 - r, 1 - c];
    case 'L':
      return [-1, 1 - r, c - 1];
  }
}

export type EdgeDir = 'top' | 'bottom' | 'left' | 'right';
export interface HiddenPartner { dir: EdgeDir; face: Face; color: Face; }

/** Hidden stickers belonging to the same physical cubie as this facelet. */
export function piecePartners(state: CubeState, face: Face, index: number): HiddenPartner[] {
  const r = Math.floor(index / 3), c = index % 3;
  const position = slotPosition(face, r, c);
  const centre = slotPosition(face, 1, 1);
  const step = (row: number, column: number): Vec => {
    const next = slotPosition(face, row, column);
    return [next[0] - centre[0], next[1] - centre[1], next[2] - centre[2]];
  };
  const dirs: [EdgeDir, boolean, Vec][] = [
    ['top', r === 0, step(0, 1)], ['bottom', r === 2, step(2, 1)],
    ['left', c === 0, step(1, 0)], ['right', c === 2, step(1, 2)]
  ];
  return dirs.filter(([, on]) => on).map(([dir, , vector]) => {
    const partnerFace = faceFromNormal(vector);
    return { dir, face: partnerFace, color: state[partnerFace][slotIndex(partnerFace, position)] };
  });
}

function faceFromNormal([x, y, z]: Vec): Face {
  if (y === 1) return 'U';
  if (y === -1) return 'D';
  if (z === 1) return 'F';
  if (z === -1) return 'B';
  if (x === 1) return 'R';
  return 'L';
}

function slotIndex(face: Face, [x, y, z]: Vec): number {
  let r = 0;
  let c = 0;
  switch (face) {
    case 'U':
      c = x + 1;
      r = z + 1;
      break;
    case 'D':
      c = x + 1;
      r = 1 - z;
      break;
    case 'F':
      c = x + 1;
      r = 1 - y;
      break;
    case 'B':
      c = 1 - x;
      r = 1 - y;
      break;
    case 'R':
      c = 1 - z;
      r = 1 - y;
      break;
    case 'L':
      c = z + 1;
      r = 1 - y;
      break;
  }
  if (![r, c].every((value) => Number.isInteger(value) && value >= 0 && value <= 2)) return -1;
  return r * 3 + c;
}
