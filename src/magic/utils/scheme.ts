import { CubeViewPref as Orientation, FaceColor, LetterScheme } from '../types/app';
import { CORNER_SLOTS, EDGE_SLOTS, FACES, Face, PieceType, letterFor, slotPosition } from './cube';

type Vec = [number, number, number];

export interface StickerInfo {
  id: string;
  face: Face;
  index: number;
  type: PieceType;
  pos: Vec;
  piece: string;
}

const AXIS_FACES: [number, Face, Face][] = [
[1, 'U', 'D'],
[2, 'F', 'B'],
[0, 'R', 'L']];


function pieceName(face: Face, pos: Vec): string {
  const faces: Face[] = [face];
  AXIS_FACES.forEach(([axis, plus, minus]) => {
    if (pos[axis] === 1 && plus !== face) faces.push(plus);
    if (pos[axis] === -1 && minus !== face) faces.push(minus);
  });
  return faces.join('');
}

function build(type: PieceType, slots: number[]): StickerInfo[] {
  return FACES.flatMap((face) =>
  slots.map((index) => {
    const pos = slotPosition(face, Math.floor(index / 3), index % 3);
    return { id: `${face}${index}`, face, index, type, pos, piece: pieceName(face, pos) };
  })
  );
}

export const CORNER_STICKERS = build('corner', CORNER_SLOTS);
export const EDGE_STICKERS = build('edge', EDGE_SLOTS);
export const ALL_STICKERS = [...CORNER_STICKERS, ...EDGE_STICKERS];
const BY_ID = new Map(ALL_STICKERS.map((s) => [s.id, s]));

export const stickerById = (id: string) => BY_ID.get(id) as StickerInfo;

export function siblingsOf(id: string): string[] {
  const s = stickerById(id);
  if (!s) return [];
  return ALL_STICKERS.filter((o) => o.type === s.type && o.pos.every((v, i) => v === s.pos[i])).map((o) => o.id);
}

export function speffzScheme(): LetterScheme {
  const scheme: LetterScheme = {};
  ALL_STICKERS.forEach((s) => scheme[s.id] = letterFor(s.face, s.index, s.type) as string);
  return scheme;
}

/** Custom lettering with multi-character and numeric tokens, for demonstration. */
export function customDemoScheme(): LetterScheme {
  const scheme = speffzScheme();
  const replace: Record<string, Record<string, string>> = {
    corner: { S: 'SH', X: 'CH' },
    edge: { X: 'TH', Q: '1' }
  };
  ALL_STICKERS.forEach((s) => {
    const next = replace[s.type][scheme[s.id]];
    if (next) scheme[s.id] = next;
  });
  return scheme;
}

export function isSpeffz(scheme: LetterScheme): boolean {
  const s = speffzScheme();
  return ALL_STICKERS.every((st) => s[st.id] === scheme[st.id]);
}

export function tokensOf(scheme: LetterScheme, type?: PieceType): string[] {
  const list = type === 'corner' ? CORNER_STICKERS : type === 'edge' ? EDGE_STICKERS : ALL_STICKERS;
  const seen: string[] = [];
  list.forEach((s) => {
    const t = scheme[s.id];
    if (t && !seen.includes(t)) seen.push(t);
  });
  return seen;
}

export const FACE_NAMES: Record<Face, string> = {
  U: 'Up',
  D: 'Down',
  F: 'Front',
  B: 'Back',
  R: 'Right',
  L: 'Left'
};

/* ---------- Orientation & colour ---------- */

export const COLOR_HEX: Record<FaceColor, string> = {
  white: '#ECEAE4',
  yellow: '#E8C443',
  green: '#2F9658',
  blue: '#2D69B7',
  red: '#C73C34',
  orange: '#E27A2D'
};

export const COLOR_TEXT: Record<FaceColor, string> = {
  white: '#151412',
  yellow: '#151412',
  orange: '#151412',
  green: '#ffffff',
  blue: '#ffffff',
  red: '#ffffff'
};

export const COLOR_NAMES: Record<FaceColor, string> = {
  white: 'White',
  yellow: 'Yellow',
  green: 'Green',
  blue: 'Blue',
  red: 'Red',
  orange: 'Orange'
};

export const ALL_COLORS: FaceColor[] = ['white', 'yellow', 'green', 'blue', 'red', 'orange'];

const COLOR_VEC: Record<FaceColor, Vec> = {
  white: [0, 1, 0],
  yellow: [0, -1, 0],
  green: [0, 0, 1],
  blue: [0, 0, -1],
  red: [1, 0, 0],
  orange: [-1, 0, 0]
};

const vecColor = (v: Vec): FaceColor =>
(Object.keys(COLOR_VEC) as FaceColor[]).find((c) => COLOR_VEC[c].every((x, i) => x === v[i])) as FaceColor;

const neg = (v: Vec): Vec => [-v[0], -v[1], -v[2]];
const cross = (a: Vec, b: Vec): Vec => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

export function faceColors(o: Orientation): Record<Face, FaceColor> {
  const t = COLOR_VEC[o.top];
  const f = COLOR_VEC[o.front];
  const r = cross(t, f);
  return { U: vecColor(t), D: vecColor(neg(t)), F: vecColor(f), B: vecColor(neg(f)), R: vecColor(r), L: vecColor(neg(r)) };
}

/** Sticker colours in the fixed scramble reference (white top, green front). */
export const REFERENCE_COLORS: Record<Face, FaceColor> = faceColors({ top: 'white', front: 'green' });

export function validFronts(top: FaceColor): FaceColor[] {
  const t = COLOR_VEC[top];
  return ALL_COLORS.filter((c) => COLOR_VEC[c].reduce((sum, v, i) => sum + v * t[i], 0) === 0);
}