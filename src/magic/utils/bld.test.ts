import { describe, expect, it } from 'vitest';
import { validateCubeState } from '../../domain/bld/trace';
import { makeChallenge, randomState, seededRandom } from './bld';
import { speffzScheme } from './scheme';
import { tokenize } from './pairs';

const setup = {
  scheme: speffzScheme(),
  edgeBuffer: 'U7',
  cornerBuffer: 'U8',
};

describe('Magic training state adapter', () => {
  it.each(['corners', 'edges', 'both'] as const)('generates legal %s states', (filter) => {
    for (let seed = 1; seed <= 30; seed++) {
      const state = randomState(filter, seededRandom(seed));
      expect(validateCubeState({
        EDGES: { pieces: state.ep, orientation: state.eo },
        CORNERS: { pieces: state.cp, orientation: state.co },
      }).legal).toBe(true);
    }
  });

  it('solves the orbit outside the selected practice scope', () => {
    const corners = randomState('corners', seededRandom(41));
    expect(corners.ep).toEqual([...Array(12).keys()]);
    expect(corners.eo).toEqual(Array(12).fill(0));
    const edges = randomState('edges', seededRandom(42));
    expect(edges.cp).toEqual([...Array(8).keys()]);
    expect(edges.co).toEqual(Array(8).fill(0));
  });

  it('derives displayed facelets and target tokens from one challenge', () => {
    const challenge = makeChallenge('both', 9472, setup);
    expect(challenge.corners.length).toBeGreaterThan(1);
    expect(challenge.edges.length).toBeGreaterThan(1);
    expect(Object.values(challenge.state).flat()).toHaveLength(54);
    expect([...challenge.corners, ...challenge.edges].every((token) => /^[A-X]$/.test(token))).toBe(true);
  });

  it('honours multi-character custom tokens and explicit boundaries', () => {
    expect(tokenize('CH·A|SH', ['A', 'C', 'CH', 'S', 'SH'])).toEqual(['CH', 'A', 'SH']);
  });
});
