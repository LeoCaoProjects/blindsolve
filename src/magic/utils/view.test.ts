import { describe, expect, it } from 'vitest';
import { stateFromScramble } from './cube';
import { applyView, COLOR_FACE, isValidView, viewForScrambledCenters } from './view';

const NORMAL = {
  U: [0, 1, 0], D: [0, -1, 0], F: [0, 0, 1], B: [0, 0, -1], R: [1, 0, 0], L: [-1, 0, 0],
} as const;

describe('default cube view', () => {
  it('maps white to the top and orange to the front', () => {
    const view = { top: 'white', front: 'orange' } as const;
    expect(isValidView(view)).toBe(true);
    expect(COLOR_FACE[view.top]).toBe('U');
    expect(COLOR_FACE[view.front]).toBe('L');
    expect(applyView(view, [...NORMAL.U])).toEqual([0, 1, 0]);
    expect(applyView(view, [...NORMAL.L])).toEqual([0, 0, 1]);
  });

  it('keeps requested center colours top/front after wide scramble moves', () => {
    const state = stateFromScramble("Rw' Dw2");
    const desired = { top: 'white', front: 'orange' } as const;
    const camera = viewForScrambledCenters(state, desired);
    const topFace = (Object.keys(state) as Array<keyof typeof state>).find((face) => state[face][4] === 'U')!;
    const frontFace = (Object.keys(state) as Array<keyof typeof state>).find((face) => state[face][4] === 'L')!;

    expect(applyView(camera, [...NORMAL[topFace]])).toEqual([0, 1, 0]);
    expect(applyView(camera, [...NORMAL[frontFace]])).toEqual([0, 0, 1]);
  });
});
