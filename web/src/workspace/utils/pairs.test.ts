import { describe, expect, it } from "vitest";
import { resolveWords, timerWords, toTimerDb } from "./pairs";

describe("effective mnemonic resolution", () => {
  const entry = {
    shared: ["Apple"],
    edges: ["Arrow"],
    corners: ["Anchor"],
  };

  it("uses shared by default and piece overrides when present", () => {
    expect(resolveWords(entry, "shared").words).toEqual(["Apple"]);
    expect(resolveWords(entry, "edges").words).toEqual(["Arrow"]);
    expect(resolveWords(entry, "corners").words).toEqual(["Anchor"]);
  });

  it("falls back to shared without an override", () => {
    expect(resolveWords({ shared: ["multi word"] }, "edges")).toEqual({
      words: ["multi word"],
      source: "shared",
    });
  });

  it("treats blank optional words as Default and ignores obsolete extra values", () => {
    expect(
      resolveWords({ shared: ["Apple", "obsolete"], edges: [" "] }, "edges")
        .words,
    ).toEqual(["Apple"]);
    expect(
      resolveWords(
        { shared: ["Apple"], corners: ["Castle", "obsolete"] },
        "corners",
      ).words,
    ).toEqual(["Castle"]);
  });
  it("keeps Timer/reconstruction lookups piece-aware", () => {
    const db = toTimerDb({ "A|B": entry });
    expect(timerWords(db, "AB", "edges")).toEqual(["Arrow"]);
    expect(timerWords(db, "AB", "corners")).toEqual(["Anchor"]);
  });
});
