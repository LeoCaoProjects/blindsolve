import { describe, expect, it } from 'vitest';
import { suggestionKey, suggestionsFor } from './suggestions';

describe('shared mnemonic suggestions', () => {
  it('covers every A-Z pair with at least five distinct suggestions', () => {
    for (const first of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
      for (const second of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
        const suggestions = suggestionsFor(first, second);
        expect(new Set(suggestions.map((word) => word.toLowerCase())).size, `${first}${second}`).toBeGreaterThanOrEqual(5);
      }
    }
  });

  it('keeps multi-character token keys collision-free', () => {
    expect(suggestionKey('CH', 'A')).toBe('CH|A');
    expect(suggestionKey('C', 'HA')).toBe('C|HA');
    expect(suggestionsFor('CH', 'A')).toContain('chai');
  });

  it('never returns already-saved words', () => {
    expect(suggestionsFor('T', 'W', ['tower']).map((word) => word.toLowerCase())).not.toContain('tower');
  });
});
