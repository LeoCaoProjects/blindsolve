export interface LetterPair {
  id: string;
  firstStickerId: string;
  secondStickerId: string;
  firstToken: string;
  secondToken: string;
  primaryMnemonic: string;
  updatedAt: string;
  /** Explicit logical vocabulary; absent on legacy effective-only records. */
  vocabulary?: {
    shared: string[];
    sharedUpdatedAt: string;
    overrideUpdatedAt: string;
    override?: string[];
  };
}

export interface MemoPair {
  first: string;
  second?: string;
}

export const pairKey = (firstStickerId: string, secondStickerId: string) =>
  JSON.stringify([firstStickerId, secondStickerId]);
export const memoPairs = (tokens: string[]): MemoPair[] => {
  const result: MemoPair[] = [];
  for (let i = 0; i < tokens.length; i += 2)
    result.push({ first: tokens[i], second: tokens[i + 1] });
  return result;
};
export const normalizeMnemonic = (value: string) =>
  value.trim().toLocaleLowerCase();
export const mnemonicMatches = (
  value: string,
  pair: Pick<LetterPair, "primaryMnemonic">,
) => {
  const normalized = normalizeMnemonic(value);
  return normalizeMnemonic(pair.primaryMnemonic) === normalized;
};

export function checkTokenAnswer(expected: string[], answer: string) {
  const actual = answer
    .trim()
    .split(/[\s,·|/]+/)
    .filter(Boolean);
  const max = Math.max(expected.length, actual.length);
  const items = Array.from({ length: max }, (_, i) => ({
    expected: expected[i],
    actual: actual[i],
    correct: expected[i] === actual[i],
  }));
  return {
    correct: items.every((x) => x.correct),
    accuracy: max ? items.filter((x) => x.correct).length / max : 1,
    items,
  };
}
