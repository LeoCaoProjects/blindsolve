import { TrainFilter, invert, parity, randomOri, randomPerm, seededRandom } from './bld';
import { CubeState, stateFromScramble } from './cube';
import { KPattern } from 'cubing/kpuzzle';
import { puzzles } from 'cubing/puzzles';
import { experimentalSolve3x3x3IgnoringCenters } from 'cubing/search';
import { configureCubingSearchWorker } from '../../domain/bld/configureCubingSearch';

configureCubingSearchWorker();

/**
 * Random-state scrambles for Execution Sprint, including restricted states:
 *   pick a legal, well-shuffled state of only the requested piece type
 *   → solve it with a two-phase solver
 *   → the scramble is the inverse of that solution.
 *
 * Performance: cubing.js loads its search implementation asynchronously, and challenges are
 * prepared during browser idle time before the drill is opened.
 * Scrambles are prepared ahead of time and cached, so opening Execution Sprint or pressing
 * New scramble normally swaps in one that's already waiting. The page never blocks on it.
 * A solver failure is retried with a fresh restricted state. It never falls back to stitching
 * together commutators, because that would violate the exercise's random-state contract.
 */

interface PieceState {
  center: number[];
  cp: number[];
  co: number[];
  ep: number[];
  eo: number[];
}

const cache = new Map<string, string>();
const inflight = new Map<string, Promise<string>>();

async function solveRestrictedState(state: PieceState): Promise<string | null> {
  try {
    const kpuzzle = await puzzles['3x3x3'].kpuzzle();
    const pattern = new KPattern(kpuzzle, {
      EDGES: { pieces: state.ep, orientation: state.eo },
      CORNERS: { pieces: state.cp, orientation: state.co },
      CENTERS: { pieces: state.center, orientation: [0, 0, 0, 0, 0, 0], orientationMod: [1, 1, 1, 1, 1, 1] }
    });
    return (await experimentalSolve3x3x3IgnoringCenters(pattern)).toString();
  } catch {
    return null;
  }
}

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

/** Restricted random state. Rejects states that leave more than a piece or two solved. */
function pickState(filter: TrainFilter, rand: () => number): PieceState {
  const center = range(6);
  for (let attempt = 0; attempt < 40; attempt++) {
    if (filter === 'corners') {
      const cp = randomPerm(8, rand, 0);
      const co = randomOri(8, 3, rand);
      const solved = cp.filter((k, i) => k === i && co[i] === 0).length;
      if (solved > 1 && attempt < 39) continue;
      return { center, cp, co, ep: range(12), eo: new Array(12).fill(0) };
    }
    if (filter === 'edges') {
      const ep = randomPerm(12, rand, 0);
      const eo = randomOri(12, 2, rand);
      const solved = ep.filter((k, i) => k === i && eo[i] === 0).length;
      if (solved > 2 && attempt < 39) continue;
      return { center, cp: range(8), co: new Array(8).fill(0), ep, eo };
    }
    const cp = randomPerm(8, rand);
    return { center, cp, co: randomOri(8, 3, rand), ep: randomPerm(12, rand, parity(cp)), eo: randomOri(12, 2, rand) };
  }
  return { center, cp: range(8), co: new Array(8).fill(0), ep: range(12), eo: new Array(12).fill(0) };
}

/** The other piece type must come out solved, or the scramble isn't what was asked for. */
function respects(state: CubeState, filter: TrainFilter): boolean {
  if (filter === 'both') return true;
  const slots = filter === 'corners' ? [1, 3, 5, 7] : [0, 2, 6, 8];
  return (Object.keys(state) as (keyof CubeState)[]).every((f) => slots.every((i) => state[f][i] === f));
}

const keyOf = (filter: TrainFilter, seed: number) => `${filter}:${seed}`;

/** Already prepared? Synchronous, so a waiting scramble shows on the very first frame. */
export function cachedScramble(filter: TrainFilter, seed: number): string | null {
  return cache.get(keyOf(filter, seed)) ?? null;
}

export function randomStateScramble(filter: TrainFilter, seed: number): Promise<string> {
  const key = keyOf(filter, seed);
  const hit = cache.get(key);
  if (hit) return Promise.resolve(hit);
  const running = inflight.get(key);
  if (running) return running;
  const job = (async () => {
    for (let attempt = 0; attempt < 4; attempt++) {
      const rand = seededRandom((seed + attempt * 65537) * 104729 + (filter === 'corners' ? 11 : filter === 'edges' ? 13 : 17));
      const solution = await solveRestrictedState(pickState(filter, rand));
      if (!solution) continue;
      const candidate = invert(solution.trim().split(/\s+/).filter(Boolean)).join(' ');
      if (candidate && respects(stateFromScramble(candidate), filter)) {
        cache.set(key, candidate);
        return candidate;
      }
    }
    throw new Error(`Could not generate a legal ${filter} random-state scramble.`);
  })().finally(() => inflight.delete(key));
  inflight.set(key, job);
  return job;
}

/** Quietly prepare scrambles in the background. Safe to call repeatedly. */
export function prepareScrambles(requests: {filter: TrainFilter;seed: number;}[]) {
  requests.forEach(({ filter, seed }) => void randomStateScramble(filter, seed));
}

/** Seed that Execution Sprint opens with (matches useTrainingSession's default). */
export const FIRST_EXEC_SEED = (() => {
  const value = new Uint32Array(1);
  globalThis.crypto?.getRandomValues(value);
  return value[0] || Math.floor(Math.random() * 0xffffffff);
})();

/**
 * Called once when the app loads: when the browser is idle, start the worker and prepare the
 * first scramble for every piece choice, so Execution Sprint is ready before anyone opens it.
 */
export function warmScrambles(firstSeed = FIRST_EXEC_SEED) {
  const run = () =>
  prepareScrambles([
  { filter: 'both', seed: firstSeed },
  { filter: 'edges', seed: firstSeed },
  { filter: 'corners', seed: firstSeed },
  { filter: 'both', seed: firstSeed + 1 }]
  );
  const idle = (window as Window & {requestIdleCallback?: (cb: () => void, o?: {timeout: number;}) => number;}).requestIdleCallback;
  if (idle) idle(run, { timeout: 1500 });else
  window.setTimeout(run, 300);
}
