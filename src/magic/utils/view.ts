import { CubeViewPref, FaceColor } from '../types/app';
import { Face } from './cube';

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

const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec, b: Vec): Vec => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

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

export function sameView(a: CubeViewPref, b: CubeViewPref) {
  return a.top === b.top && a.front === b.front;
}