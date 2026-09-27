import { letterImages, mnemonicSuggestions, suggestionWordBank } from '../data/mnemonicSuggestions';

/**
 * Corpus key for a pair. Tokens are whole strings, so a custom corner token "CH" and an edge
 * token "X" can never collide: single-character pairs use "WC", anything longer uses "CH|A".
 */
export function suggestionKey(first: string, second: string): string {
  return first.length === 1 && second.length === 1 ? first + second : `${first}|${second}`;
}

/**
 * Suggestions for a pair: curated entries first, then words from the bank that fit the sounds.
 * Words the user already has saved for this pair are left out.
 */
export function suggestionsFor(first: string, second: string, exclude: string[] = []): string[] {
  const taken = new Set(exclude.map((w) => w.trim().toLowerCase()).filter(Boolean));
  const curated = mnemonicSuggestions[suggestionKey(first, second)] ?? [];
  const a = first.toLowerCase();
  const b = second.toLowerCase();
  const filler = /^[a-z]+$/.test(a + b) ?
  suggestionWordBank.filter((w) => w.startsWith(a) && w.slice(a.length).includes(b)) :
  [];
  const anchors = first.length === 1 && second.length === 1 ? [
    `${letterImages[first.toUpperCase()]?.[0] ?? first} and ${letterImages[second.toUpperCase()]?.[0] ?? second}`,
    `${letterImages[first.toUpperCase()]?.[0] ?? first} riding a ${letterImages[second.toUpperCase()]?.[1] ?? second}`,
    `${letterImages[first.toUpperCase()]?.[1] ?? first} crushing a ${letterImages[second.toUpperCase()]?.[0] ?? second}`,
    `${letterImages[second.toUpperCase()]?.[0] ?? second} juggling ${letterImages[first.toUpperCase()]?.[1] ?? first}`,
    `${letterImages[first.toUpperCase()]?.[1] ?? first} inside a giant ${letterImages[second.toUpperCase()]?.[1] ?? second}`,
  ] : [];
  const seen = new Set<string>();
  return [...curated, ...filler, ...anchors].filter((w) => {
    const k = w.toLowerCase();
    if (taken.has(k) || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
