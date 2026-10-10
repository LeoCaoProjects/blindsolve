import { describe, expect, it } from "vitest";
import { resolveWords, timerWords, toTimerDb } from "./pairs";

describe("effective mnemonic resolution", () => {
  const entry = {
    shared: ["Apple", "apricot"],
    edges: ["Arrow"],
    corners: ["Anchor"],
  };

  it("uses shared by default and piece overrides when present", () => {
    expect(resolveWords(entry, "shared").words).toEqual(["Apple", "apricot"]);
    expect(resolveWords(entry, "edges").words).toEqual(["Arrow"]);
    expect(resolveWords(entry, "corners").words).toEqual(["Anchor"]);
  });

  it("falls back to shared without an override", () => {
    expect(resolveWords({ shared: ["multi word"] }, "edges")).toEqual({
      words: ["multi word"],
      source: "shared",
    });
  });

  it("keeps Timer/reconstruction lookups piece-aware", () => {
    const db = toTimerDb({ "A|B": entry });
    expect(timerWords(db, "AB", "edges")).toEqual(["Arrow"]);
    expect(timerWords(db, "AB", "corners")).toEqual(["Anchor"]);
  });
});
