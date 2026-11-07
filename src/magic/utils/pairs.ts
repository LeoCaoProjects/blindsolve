import { LetterPairDb } from "../types/solve";
import { PairDb, PairEntry, PairScope } from "../types/app";

export const pairKey = (a: string, b: string) => `${a}|${b}`;
export const splitKey = (key: string) => key.split("|") as [string, string];

export interface Resolved {
  words: string[];
  source: "shared" | "override" | "none";
}

/** The single mnemonic rule used throughout the app: piece override, then shared default. */
export function resolveWords(
  entry: PairEntry | undefined,
  scope: PairScope,
): Resolved {
  const shared = primaryWords(entry?.shared ?? []);
  if (scope === "shared")
    return { words: shared, source: shared.length ? "shared" : "none" };
  const own = primaryWords(entry?.[scope] ?? []);
  if (own.length) return { words: own, source: "override" };
  return { words: shared, source: shared.length ? "shared" : "none" };
}

export const hasOverride = (entry?: PairEntry) =>
  !!entry && (!!entry.edges?.length || !!entry.corners?.length);

/** Words for practice when no piece type is chosen. */
export function anyWords(entry: PairEntry | undefined): string[] {
  if (!entry) return [];
  const shared = primaryWords(entry.shared);
  if (shared.length) return shared;
  return primaryWords(
    entry.edges?.length ? entry.edges : (entry.corners ?? []),
  );
}

/** Greedy longest-match tokenisation; keeps multi-character tokens intact. */
export function tokenize(raw: string, tokens: string[]): string[] {
  const sorted = [...tokens].sort((a, b) => b.length - a.length);
  const greedy = (source: string) => {
    const result: string[] = [];
    let offset = 0;
    const compact = source.toUpperCase().replace(/\s/g, "");
    while (offset < compact.length) {
      const match = sorted.find((t) =>
        compact.startsWith(t.toUpperCase(), offset),
      );
      if (match) {
        result.push(match);
        offset += match.length;
      } else {
        result.push(compact[offset]);
        offset += 1;
      }
    }
    return result;
  };
  // A deliberate dot/pipe/comma is an unambiguous token boundary for custom schemes.
  if (/[·|,/]/.test(raw)) return raw.split(/[·|,/]/).flatMap(greedy);
  const out: string[] = [];
  let i = 0;
  const s = raw.toUpperCase();
  while (i < s.length) {
    const match = sorted.find((t) => s.startsWith(t, i));
    if (match) {
      out.push(match);
      i += match.length;
    } else {
      out.push(s[i]);
      i += 1;
    }
  }
  return out;
}

export function chunkPairs<T>(list: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += 2) out.push(list.slice(i, i + 2));
  return out;
}

/** Flat Speffz-style view consumed by the Timer's reconstruction flow. */
export function toTimerDb(db: PairDb): LetterPairDb {
  const out: LetterPairDb = {};
  Object.entries(db).forEach(([key, entry]) => {
    const [a, b] = splitKey(key);
    const pair = a + b;
    const fallback = anyWords(entry);
    if (fallback.length) out[pair] = fallback;
    (["edges", "corners"] as const).forEach((piece) => {
      const words = resolveWords(entry, piece).words;
      if (words.length) out[`${piece}:${pair}`] = words;
    });
  });
  return out;
}

/** Piece-aware Timer/reconstruction lookup with legacy flat-key fallback. */
export function timerWords(
  db: LetterPairDb,
  pair: string,
  piece: "edges" | "corners",
) {
  return primaryWords(db[`${piece}:${pair}`] ?? db[pair] ?? []);
}

/** Compatibility lists contain only the one active word. Ignore obsolete extra values. */
export function primaryWords(words: string[]): string[] {
  const word = words[0]?.trim();
  return word ? [word] : [];
}
