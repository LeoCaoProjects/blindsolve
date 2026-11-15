export type MnemonicScope = "shared" | "edges" | "corners";
export interface LogicalMnemonic {
  id: string;
  identity: "logical-v1";
  scope: MnemonicScope;
  firstToken: string;
  secondToken: string;
  primaryMnemonic: string;
  updatedAt: string;
}
export const MNEMONIC_SCOPES: MnemonicScope[] = ["shared", "edges", "corners"];
/** Same policy as the lettering editor. Boundaries belong to pairs, never labels. */
export const normalizeLabel = (value: string) =>
  value.toUpperCase().replace(/\s/g, "");
export const validLabel = (value: string) =>
  value.length > 0 && value.length <= 12 && /^[^\s,·|/]+$/.test(value);
/** UI/compatibility key: pipe is excluded from labels, so token boundaries are explicit. */
export const labelPairKey = (first: string, second: string) =>
  `${normalizeLabel(first)}|${normalizeLabel(second)}`;
export function decodeLabelPairKey(key: string): [string, string] | null {
  const tokens = key.split("|").map(normalizeLabel);
  return tokens.length === 2 && tokens.every(validLabel)
    ? [tokens[0], tokens[1]]
    : null;
}
export const equalLabelPairs = (
  a: readonly [string, string],
  b: readonly [string, string],
) => labelPairKey(...a) === labelPairKey(...b);

/** Internal memo reference, separate from displayed typography. AB remains a safe legacy shorthand. */
export function memoPairReference(tokens: readonly string[]): string {
  return tokens.every((token) => [...token].length === 1)
    ? tokens.join("")
    : JSON.stringify(tokens);
}
export function memoPairTokens(reference: string): string[] {
  try {
    const values = JSON.parse(reference);
    if (
      Array.isArray(values) &&
      values.length > 0 &&
      values.length <= 2 &&
      values.every(
        (value) =>
          typeof value === "string" && (validLabel(value) || value === "·"),
      )
    )
      return values.map(normalizeLabel);
  } catch {
    /* Only one/two-character historical references have unambiguous boundaries. */
  }
  const chars = [...reference];
  return chars.length > 0 &&
    chars.length <= 2 &&
    chars.every((value) => validLabel(value) || value === "·")
    ? chars
    : [];
}
export function displayMemoPair(reference: string): string {
  const tokens = memoPairTokens(reference);
  return tokens.length
    ? tokens.join(tokens.some((value) => value.length > 1) ? " " : "")
    : reference;
}

export const mnemonicRecordKey = (
  first: string,
  second: string,
  scope: MnemonicScope,
) =>
  JSON.stringify([
    "mnemonic-v1",
    normalizeLabel(first),
    normalizeLabel(second),
    scope,
  ]);
export function parseMnemonicRecordKey(
  key: string,
): [string, string, MnemonicScope] | null {
  try {
    const value = JSON.parse(key);
    if (
      Array.isArray(value) &&
      value.length === 4 &&
      value[0] === "mnemonic-v1" &&
      typeof value[1] === "string" &&
      typeof value[2] === "string" &&
      validLabel(value[1]) &&
      validLabel(value[2]) &&
      MNEMONIC_SCOPES.includes(value[3]) &&
      mnemonicRecordKey(value[1], value[2], value[3]) === key
    )
      return [value[1], value[2], value[3]];
  } catch {
    /* Physical/legacy record keys are not logical identities. */
  }
  return null;
}
