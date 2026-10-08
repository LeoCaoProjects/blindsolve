import { LetterScheme } from '../types/app';
import { CubeState, FACES, Face, stateFromScramble } from './cube';
import { CORNER_STICKERS, EDGE_STICKERS, stickerById } from './scheme';

/**
 * Piece-level cube model and BLD tracing.
 * One challenge = one legal cube state; the rendered facelets and the traced memo
 * are both derived from it, so they can never disagree.
 */

export type TrainFilter = 'corners' | 'edges' | 'both';

/** Sticker ids per piece position, clockwise for corners (Kociemba order). */
const CORNER_POS: string[][] = [
['U8', 'R0', 'F2'],
['U6', 'F0', 'L2'],
['U0', 'L0', 'B2'],
['U2', 'B0', 'R2'],
['D2', 'F8', 'R6'],
['D0', 'L8', 'F6'],
['D6', 'B8', 'L6'],
['D8', 'R8', 'B6']];

const EDGE_POS: string[][] = [
['U5', 'R1'],
['U7', 'F1'],
['U3', 'L1'],
['U1', 'B1'],
['D5', 'R7'],
['D1', 'F7'],
['D3', 'L7'],
['D7', 'B7'],
['F5', 'R3'],
['F3', 'L5'],
['B5', 'L3'],
['B3', 'R5']];


export interface PieceState {
  cp: number[];
  co: number[];
  ep: number[];
  eo: number[];
}

export function seededRandom(seed: number): () => number {
  let a = seed >>> 0 || 1;
  return () => {
    a = a + 0x6d2b79f5 >>> 0;
    let t = a;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

export function parity(p: number[]): number {
  const seen = new Array(p.length).fill(false);
  let cycles = 0;
  for (let i = 0; i < p.length; i++) {
    if (seen[i]) continue;
    cycles++;
    for (let j = i; !seen[j]; j = p[j]) seen[j] = true;
  }
  return (p.length - cycles) % 2;
}

export function randomPerm(n: number, rand: () => number, wantParity?: number): number[] {
  const p = range(n);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  if (wantParity !== undefined && parity(p) !== wantParity) [p[0], p[1]] = [p[1], p[0]];
  return p;
}

export function randomOri(n: number, mod: number, rand: () => number): number[] {
  const o = range(n - 1).map(() => Math.floor(rand() * mod));
  const sum = o.reduce((s, v) => s + v, 0);
  o.push((mod - sum % mod) % mod);
  return o;
}

/**
 * Corners only: corners scrambled, edges solved (so corner permutation is even).
 * Edges only: edges scrambled, corners solved. Both: a full legal random state.
 */
export function randomState(filter: TrainFilter, rand: () => number): PieceState {
  if (filter === 'corners') return { cp: randomPerm(8, rand, 0), co: randomOri(8, 3, rand), ep: range(12), eo: new Array(12).fill(0) };
  if (filter === 'edges') return { cp: range(8), co: new Array(8).fill(0), ep: randomPerm(12, rand, 0), eo: randomOri(12, 2, rand) };
  const cp = randomPerm(8, rand);
  return { cp, co: randomOri(8, 3, rand), ep: randomPerm(12, rand, parity(cp)), eo: randomOri(12, 2, rand) };
}

const faceOf = (id: string) => id[0] as Face;
const indexOf = (id: string) => Number(id.slice(1));

export function toFacelets(s: PieceState): CubeState {
  const state = {} as CubeState;
  FACES.forEach((f) => state[f] = new Array<Face>(9).fill(f));
  const put = (id: string, color: Face) => state[faceOf(id)][indexOf(id)] = color;
  s.cp.forEach((k, p) => {
    for (let n = 0; n < 3; n++) put(CORNER_POS[p][(n + s.co[p]) % 3], faceOf(CORNER_POS[k][n]));
  });
  s.ep.forEach((k, p) => {
    for (let n = 0; n < 2; n++) put(EDGE_POS[p][(n + s.eo[p]) % 2], faceOf(EDGE_POS[k][n]));
  });
  return state;
}

const PIECE_OF = new Map<string, {type: 'corner' | 'edge';p: number;}>();
CORNER_POS.forEach((ids, p) => ids.forEach((id) => PIECE_OF.set(id, { type: 'corner', p })));
EDGE_POS.forEach((ids, p) => ids.forEach((id) => PIECE_OF.set(id, { type: 'edge', p })));
const HOME_KEY = {
  corner: CORNER_POS.map((ids) => ids.map(faceOf).sort().join('')),
  edge: EDGE_POS.map((ids) => ids.map(faceOf).sort().join(''))
};

/**
 * The physical sticker now sitting at `id`, named by where it belongs (its lettering id).
 * Read from the piece's colours, so a token always travels with its sticker through any scramble.
 * Edge and corner stickers resolve separately: an edge id never maps to a corner id.
 */
export function homeSticker(state: CubeState, id: string): string | null {
  const at = PIECE_OF.get(id);
  if (!at) return null;
  const pieces = at.type === 'corner' ? CORNER_POS : EDGE_POS;
  const colorAt = (s: string) => state[faceOf(s)][indexOf(s)];
  const k = HOME_KEY[at.type].indexOf(pieces[at.p].map(colorAt).sort().join(''));
  if (k === -1) return null;
  return pieces[k].find((s) => faceOf(s) === colorAt(id)) ?? null;
}

export interface Trace {
  /** Sticker ids in memo order */
  ids: string[];
  /** Indices in `ids` where a cycle break starts */
  breaks: number[];
}

/** Standard target tracing from facelets. Cycle breaks go to the first unsolved sticker in lettering order. */
export function trace(state: CubeState, type: 'corner' | 'edge', buffer: string): Trace {
  const pieces = type === 'corner' ? CORNER_POS : EDGE_POS;
  const order = (type === 'corner' ? CORNER_STICKERS : EDGE_STICKERS).map((s) => s.id);
  const pieceOf = new Map<string, number>();
  pieces.forEach((ids, p) => ids.forEach((id) => pieceOf.set(id, p)));
  const homeKey = pieces.map((ids) => ids.map(faceOf).sort().join(''));
  const colorAt = (id: string) => state[faceOf(id)][indexOf(id)];

  const target = (id: string): string => {
    const p = pieceOf.get(id) as number;
    const key = pieces[p].map(colorAt).sort().join('');
    const k = homeKey.indexOf(key);
    return pieces[k].find((s) => faceOf(s) === colorAt(id)) as string;
  };
  const solved = (p: number) => pieces[p].every((s) => target(s) === s);

  const bufPiece = pieceOf.get(buffer);
  if (bufPiece === undefined) return { ids: [], breaks: [] };

  const done = new Set<number>([bufPiece]);
  const ids: string[] = [];
  const breaks: number[] = [];
  let cur = buffer;
  let start = bufPiece;

  for (let guard = 0; guard < 64; guard++) {
    const t = target(cur);
    const tp = pieceOf.get(t) as number;
    if (tp === start) {
      if (start !== bufPiece) ids.push(t);
      const next = order.find((s) => {
        const p = pieceOf.get(s);
        return p !== undefined && !done.has(p) && !solved(p);
      });
      if (!next) break;
      breaks.push(ids.length);
      ids.push(next);
      start = pieceOf.get(next) as number;
      done.add(start);
      cur = next;
      continue;
    }
    ids.push(t);
    done.add(tp);
    cur = t;
  }
  return { ids, breaks };
}

export interface Challenge {
  seed: number;
  filter: TrainFilter;
  state: CubeState;
  corners: string[];
  edges: string[];
  cornerBreaks: number[];
  edgeBreaks: number[];
}

interface TraceSetup {
  scheme: LetterScheme;
  edgeBuffer: string;
  cornerBuffer: string;
  edgeMethod?: string;
  m2SecondTargetSwap?: boolean;
}

const M2_SPECIAL_TARGETS: Record<string, { face: string; piece: string }> = {
  'U:UF': { face: 'D', piece: 'DB' },
  'D:DB': { face: 'U', piece: 'UF' },
  'F:FU': { face: 'B', piece: 'BD' },
  'B:BD': { face: 'F', piece: 'FU' }
};

/** Convert a raw physical edge trace to the target-by-target M2 memo convention. */
export function applyM2Targets(ids: string[], setup: TraceSetup): string[] {
  if (setup.edgeMethod !== 'm2' || !setup.m2SecondTargetSwap) return ids;
  return ids.map((id, index) => {
    if (index % 2 === 0) return id;
    const sticker = stickerById(id);
    if (!sticker) return id;
    const opposite = M2_SPECIAL_TARGETS[`${sticker.face}:${sticker.piece}`];
    return opposite
      ? EDGE_STICKERS.find((candidate) => candidate.face === opposite.face && candidate.piece === opposite.piece)?.id ?? id
      : id;
  });
}

export function makeChallenge(filter: TrainFilter, seed: number, setup: TraceSetup): Challenge {
  const rand = seededRandom(seed * 7919 + (filter === 'corners' ? 1 : filter === 'edges' ? 2 : 3));
  for (let attempt = 0;; attempt++) {
    const state = toFacelets(randomState(filter, rand));
    const c = filter === 'edges' ? { ids: [], breaks: [] } : trace(state, 'corner', setup.cornerBuffer);
    const e = filter === 'corners' ? { ids: [], breaks: [] } : trace(state, 'edge', setup.edgeBuffer);
    const empty = filter !== 'edges' && c.ids.length < 2 || filter !== 'corners' && e.ids.length < 2;
    if (empty && attempt < 8) continue;
    const token = (id: string) => setup.scheme[id] || '?';
    return {
      seed,
      filter,
      state,
      corners: c.ids.map(token),
      edges: applyM2Targets(e.ids, setup).map(token),
      cornerBreaks: c.breaks,
      edgeBreaks: e.breaks
    };
  }
}

/* ---------- Scrambles for Execution Sprint: move sequences whose resulting state is traced ---------- */

const FACE_LETTERS = ['U', 'D', 'R', 'L', 'F', 'B'];
const AXIS: Record<string, number> = { U: 0, D: 0, R: 1, L: 1, F: 2, B: 2 };
/** Pure corner 3-cycle ([R U R', D]) and pure edge 3-cycle (Ua perm). Conjugates stay pure. */
const CORNER_CYCLE = "R U R' D R U' R' D'".split(' ');
const EDGE_CYCLE = "R U' R U R U R U' R' U' R2".split(' ');

function randomMoves(n: number, rand: () => number): string[] {
  const out: string[] = [];
  const faces: string[] = [];
  while (out.length < n) {
    const f = FACE_LETTERS[Math.floor(rand() * 6)];
    const last = faces[faces.length - 1];
    const prev = faces[faces.length - 2];
    if (f === last) continue;
    if (last && prev && AXIS[f] === AXIS[last] && AXIS[f] === AXIS[prev]) continue;
    faces.push(f);
    out.push(f + ['', "'", '2'][Math.floor(rand() * 3)]);
  }
  return out;
}

export function invert(moves: string[]): string[] {
  return [...moves].reverse().map((m) => m.endsWith('2') ? m : m.endsWith("'") ? m[0] : `${m}'`);
}

/** Merge adjacent turns of the same face so conjugates read like a normal scramble. */
function simplify(moves: string[]): string[] {
  const out: {f: string;q: number;}[] = [];
  moves.forEach((m) => {
    const q = m.endsWith('2') ? 2 : m.endsWith("'") ? 3 : 1;
    const top = out[out.length - 1];
    if (top && top.f === m[0]) {
      top.q = (top.q + q) % 4;
      if (top.q === 0) out.pop();
    } else out.push({ f: m[0], q });
  });
  return out.map(({ f, q }) => f + (q === 2 ? '2' : q === 3 ? "'" : ''));
}

/**
 * Offline fallback only (used if the random-state solver can't load): random moves for Both,
 * conjugated pure 3-cycles for Corners / Edges. Execution Sprint normally uses
 * utils/randomStateScramble.ts, which picks a restricted random state and solves for it.
 */
export function makeScramble(filter: TrainFilter, seed: number): string {
  const rand = seededRandom(seed * 104729 + (filter === 'corners' ? 11 : filter === 'edges' ? 13 : 17));
  if (filter === 'both') return randomMoves(20, rand).join(' ');
  const cycle = filter === 'corners' ? CORNER_CYCLE : EDGE_CYCLE;
  const moves: string[] = [];
  const blocks = 4;
  for (let b = 0; b < blocks; b++) {
    const setup = randomMoves(2 + Math.floor(rand() * 2), rand);
    moves.push(...setup, ...cycle, ...invert(setup));
  }
  return simplify(moves).join(' ');
}

/** The exact state the scramble produces, traced with the user's lettering and buffers. */
export function challengeFromScramble(scramble: string, filter: TrainFilter, seed: number, setup: TraceSetup): Challenge {
  const state = stateFromScramble(scramble);
  const c = filter === 'edges' ? { ids: [], breaks: [] } : trace(state, 'corner', setup.cornerBuffer);
  const e = filter === 'corners' ? { ids: [], breaks: [] } : trace(state, 'edge', setup.edgeBuffer);
  const token = (id: string) => setup.scheme[id] || '?';
  return {
    seed,
    filter,
    state,
    corners: c.ids.map(token),
    edges: applyM2Targets(e.ids, setup).map(token),
    cornerBreaks: c.breaks,
    edgeBreaks: e.breaks
  };
}

export const SOLVED_STATE: CubeState = toFacelets({ cp: range(8), co: new Array(8).fill(0), ep: range(12), eo: new Array(12).fill(0) });
