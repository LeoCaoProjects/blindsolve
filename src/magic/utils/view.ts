import { CubeViewPref, FaceColor } from '../types/app';
import { CubeState, Face } from './cube';

type Vec = [number, number, number];

/**
 * One rule for every cube on screen:
 *   real cube state  +  saved Default Cube View  +  physical sticker tokens  =  displayed cube.
 * The view is camera only. It never touches the state, the scramble or the lettering.
 */

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

const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec, b: Vec): Vec => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const neg = (v: Vec): Vec => [-v[0], -v[1], -v[2]];
const same = (a: Vec, b: Vec) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];

export function isValidView(v: CubeViewPref): boolean {
  return dot(FACE_VEC[COLOR_FACE[v.top]], FACE_VEC[COLOR_FACE[v.front]]) === 0;
}

/**
 * Where a colour's centre actually sits in this state. Wide moves carry centres with them, so
 * after "Fw Dw2" white may no longer be on U. Without a state, the solved position is assumed.
 */
function centreVec(color: FaceColor, state?: CubeState): Vec {
  const home = COLOR_FACE[color];
  if (!state) return FACE_VEC[home];
  const at = (Object.keys(FACE_VEC) as Face[]).find((f) => state[f]?.[4] === home);
  return FACE_VEC[at ?? home];
}

/**
 * The camera basis. Built from the centres of the chosen colours in THIS state, so the preferred
 * top/front colours always face up/forward, whatever the scramble did to the centres.
 */
function basis(v: CubeViewPref, state?: CubeState): {t: Vec;f: Vec;} {
  const view = isValidView(v) ? v : STANDARD_VIEW;
  const t = centreVec(view.top, state);
  const f = centreVec(view.front, state);
  // A legal state keeps opposite colours opposite, so this only guards malformed input.
  if (dot(t, f) !== 0) return { t: FACE_VEC[COLOR_FACE[view.top]], f: FACE_VEC[COLOR_FACE[view.front]] };
  return { t, f };
}

/** Rows [right, up, front]: rotates the chosen top/front centres onto screen up/front. */
function viewMatrix(v: CubeViewPref, state?: CubeState): [Vec, Vec, Vec] {
  const { t, f } = basis(v, state);
  return [cross(t, f), t, f];
}

/** Object-space normal → camera-space normal (y up). */
export function applyView(v: CubeViewPref, n: Vec, state?: CubeState): Vec {
  const m = viewMatrix(v, state);
  return [dot(m[0], n), dot(m[1], n), dot(m[2], n)];
}

/** CSS matrix3d for the camera rotation. CSS is y-down, so conjugate by diag(1,-1,1). */
export function viewTransform(v: CubeViewPref, state?: CubeState): string {
  const m = viewMatrix(v, state);
  const d = [1, -1, 1];
  const c = (i: number, j: number) => d[i] * m[i][j] * d[j] + 0;
  return `matrix3d(${c(0, 0)},${c(1, 0)},${c(2, 0)},0,${c(0, 1)},${c(1, 1)},${c(2, 1)},0,${c(0, 2)},${c(1, 2)},${c(2, 2)},0,0,0,0,1)`;
}

/** Text "up" of each face as laid out in the 3D construction (standard net). */
const LAYOUT_UP: Record<Face, Vec> = {
  F: FACE_VEC.U,
  B: FACE_VEC.U,
  R: FACE_VEC.U,
  L: FACE_VEC.U,
  U: FACE_VEC.B,
  D: FACE_VEC.F
};

/**
 * How far to turn a sticker's token so it reads upright from the default view.
 * Side faces read with the view's top upward; the top face reads with the far edge up;
 * the bottom face reads with the near (front) edge up, as when you tip the cube to look under it.
 * Returns a CSS rotate() angle. Purely visual; the sticker cell never changes.
 */
export function glyphRotation(face: Face, v: CubeViewPref, state?: CubeState): number {
  const { t, f } = basis(v, state);
  const n = FACE_VEC[face];
  const want = same(n, t) ? neg(f) : same(n, neg(t)) ? f : t;
  const up = LAYOUT_UP[face];
  if (same(want, up)) return 0;
  if (same(want, neg(up))) return 180;
  // n × up is a quarter turn counter-clockwise seen from outside; CSS rotate() is clockwise.
  return same(want, cross(n, up)) ? -90 : 90;
}

export function sameView(a: CubeViewPref, b: CubeViewPref) {
  return a.top === b.top && a.front === b.front;
}

export const stickerTextRotation = glyphRotation;

export function viewForScrambledCenters(state: CubeState, desired: CubeViewPref): CubeViewPref {
  const faces = Object.keys(FACE_VEC) as Face[];
  const top = faces.find((face) => state[face][4] === COLOR_FACE[desired.top]);
  const front = faces.find((face) => state[face][4] === COLOR_FACE[desired.front]);
  if (!top || !front) return desired;
  const adjusted = { top: FACE_COLOR[top], front: FACE_COLOR[front] };
  return isValidView(adjusted) ? adjusted : desired;
}
