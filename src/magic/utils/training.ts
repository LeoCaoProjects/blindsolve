import type { TokenMark } from '../components/memo/SequenceView';
import { Piece } from '../types/solve';
import { chunkPairs, tokenize } from './pairs';

export interface TrainGroup {
  piece: Piece;
  tokens: string[];
}

export interface GroupResult {
  piece: Piece;
  actual: string[];
  typed: string[];
  correct: boolean;
  typedMarks: TokenMark[];
  actualMarks: TokenMark[];
  wrong: number;
}

/** Position-by-position comparison of typed targets against the traced memo. */
export function compareGroups(groups: TrainGroup[], inputs: string[], vocabulary: string[]): GroupResult[] {
  return groups.map((g, gi) => {
    const typed = tokenize(inputs[gi] ?? '', vocabulary);
    const len = Math.max(typed.length, g.tokens.length);
    const typedMarks: TokenMark[] = [];
    const actualMarks: TokenMark[] = [];
    let wrong = 0;
    for (let i = 0; i < len; i++) {
      const t = typed[i];
      const a = g.tokens[i];
      if (t !== undefined && a !== undefined) {
        typedMarks.push(t === a ? 'ok' : 'wrong');
        actualMarks.push(t === a ? 'ok' : 'missing');
        if (t !== a) wrong++;
      } else if (a !== undefined) {
        actualMarks.push('missing');
        wrong++;
      } else {
        typedMarks.push('extra');
        wrong++;
      }
    }
    return { piece: g.piece, actual: g.tokens, typed, correct: wrong === 0, typedMarks, actualMarks, wrong };
  });
}

/**
 * main / alternate: matches a saved word (correct)
 * wrong: the pair has saved words and the answer matches none of them
 * missing: the pair has saved words and nothing was entered
 * new: no saved word yet, something was entered
 * blank: no saved word and nothing entered
 * extra: a word typed after the memo ended; there is no pair at this position
 */
export type FullStatus = 'main' | 'alternate' | 'wrong' | 'missing' | 'new' | 'blank' | 'extra';

export interface FullRow {
  id: string;
  a: string;
  b: string;
  piece: Piece;
  /** Position within its piece group (0-based), matching the typed word's position */
  index: number;
  typed: string;
  stored: string[];
  status: FullStatus;
}

/**
 * Strictly positional: expected pair n ↔ typed word n. Leftover expected pairs are missing,
 * leftover typed words are extra. Nothing typed is ever dropped.
 */
export function gradeFullMemo(
groups: TrainGroup[],
words: string[][],
stored: (a: string, b: string, piece: Piece) => string[])
: FullRow[] {
  return groups.flatMap((g, gi) => {
    const pairs = fullPairs(g.tokens);
    const typedAll = (words[gi] ?? []).map((w) => w.trim());
    const rows: FullRow[] = pairs.map(([a, b], i) => {
      const saved = stored(a, b, g.piece);
      const typed = typedAll[i] ?? '';
      const hit = saved.findIndex((w) => w.toLowerCase() === typed.toLowerCase());
      const status: FullStatus = !saved.length ?
      typed ?
      'new' :
      'blank' :
      !typed ?
      'missing' :
      hit === 0 ?
      'main' :
      hit > 0 ?
      'alternate' :
      'wrong';
      return { id: `${g.piece}-${i}`, a, b, piece: g.piece, index: i, typed, stored: saved, status };
    });
    typedAll.slice(pairs.length).forEach((typed, k) => {
      if (!typed) return;
      const i = pairs.length + k;
      rows.push({ id: `${g.piece}-x${i}`, a: '', b: '', piece: g.piece, index: i, typed, stored: [], status: 'extra' });
    });
    return rows;
  });
}

export function isFullCorrect(status: FullStatus): boolean {
  return status === 'main' || status === 'alternate';
}

/** Full letter pairs only — a trailing single target has no word slot. */
export function fullPairs(tokens: string[]): [string, string][] {
  return chunkPairs(tokens).filter((p) => p.length === 2) as [string, string][];
}

export function trailingTarget(tokens: string[]): string | null {
  return tokens.length % 2 === 1 ? tokens[tokens.length - 1] : null;
}