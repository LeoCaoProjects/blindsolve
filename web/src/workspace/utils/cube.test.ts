import { describe, expect, it } from 'vitest';
import { FACES, physicalStickerAt, slotType, stateFromScramble } from './cube';

describe('physical sticker lettering', () => {
  it('matches every sticker location on a solved cube', () => {
    const state = stateFromScramble('');
    FACES.forEach((face) => {
      state[face].forEach((_, index) => {
        if (slotType(index)) expect(physicalStickerAt(state, face, index)).toBe(`${face}${index}`);
      });
    });
  });

  it('moves the configured sticker identity with a scrambled cubie', () => {
    const state = stateFromScramble('R');

    // R sends the physical U2 sticker to the B6 display location.
    expect(state.B[6]).toBe('U');
    expect(physicalStickerAt(state, 'B', 6)).toBe('U2');
    expect(physicalStickerAt(state, 'U', 2)).not.toBe('U2');
  });

  it('keeps every edge and corner identity unique after a scramble', () => {
    const state = stateFromScramble("R U R' F2 D L2 B U2 F'");
    const ids = FACES.flatMap((face) =>
      state[face].map((_, index) => physicalStickerAt(state, face, index)).filter(Boolean)
    );
    expect(ids).toHaveLength(48);
    expect(new Set(ids)).toHaveLength(48);
  });
});
