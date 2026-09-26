import { CubeViewPref, FaceColor } from '../types/app';
import { CubeState, FACES, Face } from './cube';

type Vec = [number, number, number];

/** Fixed scramble reference: white top, green front. */
export const STANDARD_VIEW: CubeViewPref = { top: 'white', front: 'green' };

export const COLOR_FACE: Record<FaceColor, Face> = {
  white: 'U',
  yellow: 'D',
  green: 'F',
  blue: 'B',
  red: 'R',
  orange: 'L'
};

export const FACE_COLOR: Record<Face, FaceColor> = {
  U: 'white',
  D: 'yellow',
  F: 'green',
  B: 'blue',
  R: 'red',
  L: 'orange'
};

const FACE_VEC: Record<Face, Vec> = {
  U: [0, 1, 0],
  D: [0, -1, 0],
  F: [0, 0, 1],
  B: [0, 0, -1],
  R: [1, 0, 0],
  L: [-1, 0, 0]
};

/** Direction in which an unrotated glyph points on each face. */
const FACE_TEXT_UP: Record<Face, Vec> = {
  U: [0, 0, -1],
  D: [0, 0, 1],
  F: [0, 1, 0],
  B: [0, 1, 0],
  R: [0, 1, 0],
  L: [0, 1, 0]
};

/** Direction reached by a clockwise 90° CSS rotation of a glyph. */
const FACE_TEXT_RIGHT: Record<Face, Vec> = {
  U: [1, 0, 0],
  D: [1, 0, 0],
  F: [1, 0, 0],
  B: [-1, 0, 0],
  R: [0, 0, -1],
  L: [0, 0, 1]
};

const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec, b: Vec): Vec => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const sameVec = (a: Vec, b: Vec) => a.every((value, index) => value === b[index]);
const negative = ([x, y, z]: Vec): Vec => [-x, -y, -z];

export function isValidView(v: CubeViewPref): boolean {
  return dot(FACE_VEC[COLOR_FACE[v.top]], FACE_VEC[COLOR_FACE[v.front]]) === 0;
}

/** Rows [right, up, front]: rotates the chosen top/front faces onto screen up/front. */
function viewMatrix(v: CubeViewPref): [Vec, Vec, Vec] {
  const view = isValidView(v) ? v : STANDARD_VIEW;
  const t = FACE_VEC[COLOR_FACE[view.top]];
  const f = FACE_VEC[COLOR_FACE[view.front]];
  return [cross(t, f), t, f];
}

/** Object-space normal → camera-space normal (y up). */
export function applyView(v: CubeViewPref, n: Vec): Vec {
  const m = viewMatrix(v);
  return [dot(m[0], n), dot(m[1], n), dot(m[2], n)];
}

/** CSS matrix3d for the camera rotation. CSS is y-down, so conjugate by diag(1,-1,1). */
export function viewTransform(v: CubeViewPref): string {
  const m = viewMatrix(v);
  const d = [1, -1, 1];
  const c = (i: number, j: number) => d[i] * m[i][j] * d[j] + 0;
  return `matrix3d(${c(0, 0)},${c(1, 0)},${c(2, 0)},0,${c(0, 1)},${c(1, 1)},${c(2, 1)},0,${c(0, 2)},${c(1, 2)},${c(2, 2)},0,0,0,0,1)`;
}

/**
 * Quarter-turn needed to keep a sticker token readable in the selected frame.
 * Side-face text points toward the selected top. On the selected top face it
 * points away from the selected front, matching how a cube is read from above.
 */
export function stickerTextRotation(face: Face, v: CubeViewPref): number {
  const view = isValidView(v) ? v : STANDARD_VIEW;
  const normal = FACE_VEC[face];
  const top = FACE_VEC[COLOR_FACE[view.top]];
  const front = FACE_VEC[COLOR_FACE[view.front]];
  const topAlignment = dot(normal, top);
  const desiredUp = topAlignment === 0 ? top : topAlignment > 0 ? negative(front) : front;
  const baseUp = FACE_TEXT_UP[face];
  const baseRight = FACE_TEXT_RIGHT[face];

  if (sameVec(desiredUp, baseUp)) return 0;
  if (sameVec(desiredUp, baseRight)) return 90;
  if (sameVec(desiredUp, negative(baseUp))) return 180;
  if (sameVec(desiredUp, negative(baseRight))) return -90;
  return 0;
}

export function sameView(a: CubeViewPref, b: CubeViewPref) {
  return a.top === b.top && a.front === b.front;
}

/**
 * Convert a colour preference into the current face frame of a scrambled cube.
 * 3BLD scrambles may contain wide turns, so centers are not guaranteed to
 * remain on their reference U/F/etc. faces even though the user still expects
 * their chosen center colours to appear on top and at the front.
 */
export function viewForScrambledCenters(state: CubeState, desired: CubeViewPref): CubeViewPref {
  const topColor = COLOR_FACE[desired.top];
  const frontColor = COLOR_FACE[desired.front];
  const topFace = FACES.find((face) => state[face][4] === topColor);
  const frontFace = FACES.find((face) => state[face][4] === frontColor);
  if (!topFace || !frontFace) return desired;
  const adjusted = { top: FACE_COLOR[topFace], front: FACE_COLOR[frontFace] };
  return isValidView(adjusted) ? adjusted : desired;
}
