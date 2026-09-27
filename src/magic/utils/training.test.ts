import { describe, expect, it } from 'vitest';
import { gradeFullMemo, type TrainGroup } from './training';

describe('Full Memo validation', () => {
  const groups: TrainGroup[] = [{ piece: 'edges', tokens: ['A', 'D', 'B', 'N'] }];
  const stored = (a: string, b: string) => a === 'A' && b === 'D' ? ['advert', 'ad'] : [];

  it('accepts only primary or alternate saved mnemonics', () => {
    expect(gradeFullMemo(groups, [['advert', 'banana']], stored).map((row) => row.status)).toEqual(['main', 'new']);
    expect(gradeFullMemo(groups, [['AD', '']], stored).map((row) => row.status)).toEqual(['alternate', 'blank']);
    expect(gradeFullMemo(groups, [['wetqw', '']], stored)[0].status).toBe('wrong');
  });

  it('normalises case and whitespace without fuzzy matching', () => {
    expect(gradeFullMemo(groups, [['  AdVeRt  ', '']], stored)[0].status).toBe('main');
    expect(gradeFullMemo(groups, [['advertise', '']], stored)[0].status).toBe('wrong');
  });
});
