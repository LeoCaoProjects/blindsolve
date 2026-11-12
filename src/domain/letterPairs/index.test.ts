import { describe, expect, it } from "vitest";
import { checkTokenAnswer, memoPairs, mnemonicMatches, pairKey } from ".";
describe("letter pair domain", () => {
  it("uses collision-free sticker pairs", () => {
    expect(pairKey("C", "H")).not.toBe(pairKey("CH", ""));
  });
  it("keeps an odd trailing memo token", () => {
    expect(memoPairs(["A", "P", "BN"])).toEqual([
      { first: "A", second: "P" },
      { first: "BN", second: undefined },
    ]);
  });
  it("compares mnemonics case-insensitively but not fuzzily", () => {
    const p = { primaryMnemonic: "World Cup" };
    expect(mnemonicMatches(" world cup ", p)).toBe(true);
    expect(mnemonicMatches("world cups", p)).toBe(false);
  });
  it("checks tokenized answers without ambiguous concatenation", () => {
    expect(checkTokenAnswer(["CH", "A"], "CH A").correct).toBe(true);
    expect(checkTokenAnswer(["CH", "A"], "CHA").correct).toBe(false);
  });
});
