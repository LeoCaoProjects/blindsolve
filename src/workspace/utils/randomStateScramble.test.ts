import { describe, expect, it } from 'vitest';
import { stateFromScramble, type CubeState, type Face } from './cube';
import { randomStateScramble } from './randomStateScramble';

const faces: Face[] = ['U', 'L', 'F', 'R', 'B', 'D'];
const solvedSlots = (state: CubeState, slots: number[]) =>
  faces.every((face) => slots.every((slot) => state[face][slot] === face));

describe('Execution Sprint restricted random-state scrambles', () => {
  it('keeps every edge solved for a corner-only challenge', async () => {
    const scramble = await randomStateScramble('corners', 4101);
    const state = stateFromScramble(scramble);
    expect(solvedSlots(state, [1, 3, 5, 7])).toBe(true);
    expect(solvedSlots(state, [0, 2, 6, 8])).toBe(false);
  }, 60_000);

  it('keeps every corner solved for an edge-only challenge', async () => {
    const scramble = await randomStateScramble('edges', 4102);
    const state = stateFromScramble(scramble);
    expect(solvedSlots(state, [0, 2, 6, 8])).toBe(true);
    expect(solvedSlots(state, [1, 3, 5, 7])).toBe(false);
  }, 60_000);
});
