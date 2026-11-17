import type { Penalty } from "../types/solve";
export const DEFAULT_PENALTIES: Penalty[] = ["ok", "+2", "dnf"];
export function penaltyForKey(
  key: string,
  results: Penalty[] = DEFAULT_PENALTIES,
): Penalty | undefined {
  const index = ["1", "2", "3"].indexOf(key);
  return index < 0 ? undefined : results[index];
}
