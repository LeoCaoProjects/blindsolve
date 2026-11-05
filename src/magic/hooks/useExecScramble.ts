import { useEffect, useState } from "react";
import { TrainFilter } from "../utils/bld";
import {
  cachedScramble,
  prepareScrambles,
  randomStateScramble,
} from "../utils/randomStateScramble";

/**
 * Execution Sprint's scramble for (filter, seed). Returns a prepared one straight away when it's
 * waiting in the cache (the normal case); null only while one is still being prepared.
 * Always keeps the next scrambles for this piece choice preparing in the background.
 */
export function useExecScramble(
  filter: TrainFilter,
  seed: number,
  enabled: boolean,
  onError?: (key: string) => void,
): string | null {
  const key = `${filter}:${seed}`;
  const [ready, setReady] = useState<{ key: string; scramble: string } | null>(
    () => {
      const scramble = cachedScramble(filter, seed);
      return scramble ? { key, scramble } : null;
    },
  );

  useEffect(() => {
    // Look ahead even when Execution Sprint isn't open, so switching to it is instant.
    prepareScrambles([
      { filter, seed },
      { filter, seed: seed + 1 },
      { filter, seed: seed + 2 },
    ]);
    if (!enabled) return;
    const cached = cachedScramble(filter, seed);
    if (cached) {
      // Freeze this challenge's prepared result in session state. Reading the
      // shared warm-up cache on every unrelated render could replace the
      // visible scramble while its filter/seed identity had not changed.
      setReady((current) =>
        current?.key === key ? current : { key, scramble: cached },
      );
      return;
    }
    let live = true;
    randomStateScramble(filter, seed)
      .then((scramble) => {
        if (live) setReady({ key, scramble });
      })
      .catch(() => {
        if (live) onError?.(key);
      });
    return () => {
      live = false;
    };
  }, [filter, seed, enabled, key, onError]);

  return ready?.key === key ? ready.scramble : null;
}
