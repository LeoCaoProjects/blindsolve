import { describe, expect, it } from "vitest";
import { applyM2SecondTargetSwap } from "./memoConventions";
import { createSpeffzScheme } from "./speffz";
import type { LetteringScheme, TraceSection } from "./types";

const section = (
  ids: string[],
  scheme: LetteringScheme,
  cycleBreaks: number[] = [],
): TraceSection => ({
  pieceType: "edge",
  status: "complete",
  targets: ids.map((stickerId, index) => ({
    stickerId,
    pieceIndex: scheme.stickers[stickerId].pieceIndex,
    token: scheme.stickers[stickerId].label,
    cycleBreak: cycleBreaks.includes(index),
  })),
  visitedPieces: [],
  validCycleBreaks: [],
});

describe("M2 second-target convention", () => {
  it("swaps both physical UF/DB target pairs only in even memo positions", () => {
    const scheme = createSpeffzScheme();
    const converted = applyM2SecondTargetSwap(
      section(["F:UF", "F:UF", "U:UF", "U:UF", "D:DR"], scheme),
      scheme,
    );
    expect(converted.targets.map((target) => target.stickerId)).toEqual([
      "F:UF", "B:DB", "U:UF", "D:DB", "D:DR",
    ]);
    expect(converted.targets.map((target) => target.token)).toEqual(["I", "S", "C", "W", "V"]);
  });

  it("uses custom labels from the opposite physical target", () => {
    const scheme = createSpeffzScheme();
    scheme.stickers["F:UF"].label = "EAST";
    scheme.stickers["B:DB"].label = "OMEGA";
    scheme.stickers["U:UF"].label = "TOP-UF";
    scheme.stickers["D:DB"].label = "DOWN-DB";
    const converted = applyM2SecondTargetSwap(
      section(["D:DR", "F:UF", "D:DL", "D:DB"], scheme),
      scheme,
    );
    expect(converted.targets.map((target) => target.token)).toEqual([
      "V", "OMEGA", "X", "TOP-UF",
    ]);
  });

  it("keeps one global parity count across cycle breaks", () => {
    const scheme = createSpeffzScheme();
    const raw = section(
      ["D:DR", "F:UF", "U:UF", "F:UF", "D:DB", "U:UF"],
      scheme,
      [2, 5],
    );
    const converted = applyM2SecondTargetSwap(raw, scheme);
    expect(converted.targets.map((target) => target.stickerId)).toEqual([
      "D:DR", "B:DB", "U:UF", "B:DB", "D:DB", "D:DB",
    ]);
    expect(converted.targets.map((target) => target.cycleBreak)).toEqual([
      false, false, true, false, false, true,
    ]);
  });

  it("handles odd trailing targets by their global one-based position", () => {
    const scheme = createSpeffzScheme();
    const oddCount = applyM2SecondTargetSwap(
      section(["D:DR", "F:UF", "U:UF"], scheme),
      scheme,
    );
    const evenCount = applyM2SecondTargetSwap(
      section(["D:DR", "F:UF", "U:UF", "U:UF"], scheme),
      scheme,
    );
    expect(oddCount.targets.at(-1)?.stickerId).toBe("U:UF");
    expect(evenCount.targets.at(-1)?.stickerId).toBe("D:DB");
  });

  it("does not mutate the raw trace", () => {
    const scheme = createSpeffzScheme();
    const raw = section(["D:DR", "F:UF"], scheme);
    applyM2SecondTargetSwap(raw, scheme);
    expect(raw.targets[1]).toMatchObject({ stickerId: "F:UF", token: "I" });
  });
});
