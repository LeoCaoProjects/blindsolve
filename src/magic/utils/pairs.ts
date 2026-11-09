import { LetterPairDb } from "../types/solve";
import { PairDb, PairEntry, PairScope } from "../types/app";

import {
  labelPairKey,
  decodeLabelPairKey,
  normalizeLabel,
  memoPairTokens,
} from "../../domain/letterPairs/identity";
export const pairKey = labelPairKey;
export const splitKey = (key: string): [string, string] =>
  decodeLabelPairKey(key) ?? ["", ""];

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

/** Explicit boundaries keep custom labels atomic. Ambiguous compact sequences are never guessed. */
export function tokenize(raw: string, tokens: string[]): string[] {
  const vocabulary = [...new Set(tokens.map(normalizeLabel))].filter(Boolean);
  const set = new Set(vocabulary);
  const segment = (source: string): string[] => {
    if (!source) return [];
    if (set.has(source) && source.length > 1) return [source];
    if (source.length > 4096) return [""];
    const ways: string[][][] = Array.from(
      { length: source.length + 1 },
      () => [],
    );
    ways[source.length] = [[]];
    for (let i = source.length - 1; i >= 0; i--) {
      for (const token of vocabulary) {
        if (!source.startsWith(token, i)) continue;
        for (const rest of ways[i + token.length]) {
          ways[i].push([token, ...rest]);
          if (ways[i].length >= 2) break;
        }
        if (ways[i].length >= 2) break;
      }
    }
    return ways[0].length === 1
      ? ways[0][0]
      : ways[0].length > 1
        ? [""]
        : [...source];
  };
  return raw
    .toUpperCase()
    .split(/[\s·|,/]+/)
    .filter(Boolean)
    .flatMap(segment);
}

export function chunkPairs<T>(list: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += 2) out.push(list.slice(i, i + 2));
  return out;
}

/** Boundary-safe lookup keys, with legacy aliases only for unambiguous single-character pairs. */
export function toTimerDb(db: PairDb): LetterPairDb {
  const out: LetterPairDb = {};
  Object.entries(db).forEach(([key, entry]) => {
    const [a, b] = splitKey(key);
    if (!a || !b) return;
    const keys = [
      pairKey(a, b),
      ...(a.length === 1 && b.length === 1 ? [a + b] : []),
    ];
    for (const pair of keys) {
      const fallback = primaryWords(entry.shared);
      if (fallback.length) out[pair] = fallback;
      for (const piece of ["edges", "corners"] as const) {
        const words = resolveWords(entry, piece).words;
        if (words.length) out[`${piece}:${pair}`] = words;
      }
    }
  });
  return out;
}
export function timerDefaultWords(db: LetterPairDb, tokens: readonly string[]) {
  if (tokens.length !== 2) return [];
  const [a, b] = tokens.map(normalizeLabel);
  return primaryWords(
    db[pairKey(a, b)] ??
      (a.length === 1 && b.length === 1 ? db[a + b] : undefined) ??
      [],
  );
}
export function timerWords(
  db: LetterPairDb,
  pair: string | readonly string[],
  piece: "edges" | "corners",
) {
  const labels =
    typeof pair === "string"
      ? (decodeLabelPairKey(pair) ?? memoPairTokens(pair))
      : pair;
  if (labels.length !== 2) return [];
  const [a, b] = labels.map(normalizeLabel);
  const key = pairKey(a, b);
  return primaryWords(
    db[`${piece}:${key}`] ??
      db[key] ??
      (a.length === 1 && b.length === 1
        ? (db[`${piece}:${a + b}`] ?? db[a + b])
        : undefined) ??
      [],
  );
}

/** Compatibility lists contain only the one active word. Ignore obsolete extra values. */
export function primaryWords(words: string[]): string[] {
  const word = words[0]?.trim();
  return word ? [word] : [];
}
