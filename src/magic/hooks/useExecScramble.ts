import { useEffect, useState } from 'react';
import { TrainFilter } from '../utils/bld';
import { cachedScramble, prepareScrambles, randomStateScramble } from '../utils/randomStateScramble';

/**
 * Execution Sprint's scramble for (filter, seed). Returns a prepared one straight away when it's
 * waiting in the cache (the normal case); null only while one is still being prepared.
 * Always keeps the next scrambles for this piece choice preparing in the background.
 */
export function useExecScramble(filter: TrainFilter, seed: number, enabled: boolean): string | null {
  const key = `${filter}:${seed}`;
  const [ready, setReady] = useState<{key: string;scramble: string;} | null>(null);
  const cached = cachedScramble(filter, seed);

  useEffect(() => {
    // Look ahead even when Execution Sprint isn't open, so switching to it is instant.
    prepareScrambles([
    { filter, seed },
    { filter, seed: seed + 1 },
    { filter, seed: seed + 2 }]
    );
    if (!enabled || cachedScramble(filter, seed)) return;
    let live = true;
    randomStateScramble(filter, seed).then((scramble) => {
      if (live) setReady({ key, scramble });
    });
    return () => {
      live = false;
    };
  }, [filter, seed, enabled, key]);

  return cached ?? (ready?.key === key ? ready.scramble : null);
}