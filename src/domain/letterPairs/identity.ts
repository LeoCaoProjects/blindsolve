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
