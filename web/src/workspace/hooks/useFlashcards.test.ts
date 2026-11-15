import { describe, expect, it } from 'vitest';
import { Card, CardPiece, distinctMnemonicCardCount } from './useFlashcards';

const card = (key: string, piece: CardPiece): Card => ({ key, piece });

describe('distinctMnemonicCardCount', () => {
  it('counts shared edge/corner presentation variants once', () => {
    const cards = [card('W\u0000C', 'edges'), card('W\u0000C', 'corners')];
    expect(distinctMnemonicCardCount(cards, () => ['World Cup'])).toBe(1);
  });

  it('counts 100 shared pairs as 100 rather than 200', () => {
    const cards = Array.from({ length: 100 }, (_, i) => [
      card(`A\u0000${i}`, 'edges'),
      card(`A\u0000${i}`, 'corners'),
    ]).flat();
    expect(distinctMnemonicCardCount(cards, (key) => [`word-${key}`])).toBe(100);
  });

  it.each(['edges', 'corners'] as const)('counts one %s-only card once', (piece) => {
    expect(distinctMnemonicCardCount([card('W\u0000C', piece)], () => ['World Cup'])).toBe(1);
  });

  it('counts genuinely different edge and corner answers separately', () => {
    const cards = [card('W\u0000C', 'edges'), card('W\u0000C', 'corners')];
    expect(
      distinctMnemonicCardCount(cards, (_key, piece) =>
        piece === 'edges' ? ['World Cup'] : ['Water closet']
      )
    ).toBe(2);
  });

  it('does not double-count an override identical to the shared answer', () => {
    const cards = [card('W\u0000C', 'edges'), card('W\u0000C', 'corners')];
    expect(
      distinctMnemonicCardCount(cards, (_key, piece) =>
        piece === 'edges' ? ['World Cup'] : [' world cup ']
      )
    ).toBe(1);
  });
});
