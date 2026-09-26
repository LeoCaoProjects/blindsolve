import { CubeViewPref } from '../types/app';
import { FACES, Face } from './cube';
import { applyView } from './view';

export interface Rot {
  x: number;
  y: number;
}

/** Three-quarter view showing U · F · R (relative to the saved default view). */
export const FRONT_ROT: Rot = { x: -27, y: -37 };

const NORMALS: Record<Face, [number, number, number]> = {
  U: [0, 1, 0],
  D: [0, -1, 0],
  F: [0, 0, 1],
  B: [0, 0, -1],
  R: [1, 0, 0],
  L: [-1, 0, 0]
};

/** How squarely a face points at the viewer (1 = head-on, ≤0 = hidden). Mirrors the CSS transform order. */
export function faceDepth(face: Face, rot: Rot, camera: CubeViewPref): number {
  const rx = rot.x * Math.PI / 180;
  const ry = rot.y * Math.PI / 180;
  const [nx, ny, nz] = applyView(camera, NORMALS[face]);
  const y = -ny;
  const z1 = -nx * Math.sin(ry) + nz * Math.cos(ry);
  return y * Math.sin(rx) + z1 * Math.cos(rx);
}

export function visibleFaces(rot: Rot, camera: CubeViewPref, min = 0.15): Face[] {
  return FACES.filter((f) => faceDepth(f, rot, camera) > min).sort((a, b) => faceDepth(b, rot, camera) - faceDepth(a, rot, camera));
}

/** The same cube seen from the other side: walk around it. Always shows the three faces the first view hides. */
export function oppositeRot(r: Rot): Rot {
  return { x: -r.x, y: r.y + 180 };
}

/**
 * Nearest three-quarter view (from the default) that shows every target face.
 * If no single view can (opposite faces), shows the first and reports the rest as hidden.
 */
export function bestRotation(faces: Face[], camera: CubeViewPref, from: Rot = FRONT_ROT): {rot: Rot;hidden: Face[];} {
  const unique = Array.from(new Set(faces));
  const candidates: {rot: Rot;cost: number;}[] = [];
  [FRONT_ROT.x, -FRONT_ROT.x].forEach((x, xi) => {
    [0, 1, 3, 2].forEach((k) => {
      candidates.push({ rot: { x, y: FRONT_ROT.y + 90 * k }, cost: (k === 0 ? 0 : k === 2 ? 2 : 1) + xi * 1.5 });
    });
  });
  candidates.sort((a, b) => a.cost - b.cost);
  const shows = (r: Rot, f: Face) => faceDepth(f, r, camera) > 0.2;

  let pick = candidates.find((c) => unique.every((f) => shows(c.rot, f)));
  let hidden: Face[] = [];
  if (!pick) {
    pick = candidates.find((c) => shows(c.rot, unique[0])) ?? candidates[0];
    hidden = unique.filter((f) => !shows(pick!.rot, f));
  }
  // Turn the short way round from wherever the cube is now.
  const y = pick.rot.y + 360 * Math.round((from.y - pick.rot.y) / 360);
  return { rot: { x: pick.rot.x, y }, hidden };
}