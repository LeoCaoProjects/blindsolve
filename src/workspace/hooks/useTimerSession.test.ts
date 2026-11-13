import { describe, expect, it } from "vitest";
import { createSpeffzScheme } from "../../domain/bld/speffz";
import type { TraceTarget } from "../../domain/bld/types";
import { snapshot } from "./useTimerSession";

const target = (
  stickerId: string,
  token: string,
  cycleBreak = false,
): TraceTarget => ({ stickerId, token, cycleBreak, pieceIndex: 0 });

describe("timer memo snapshots", () => {
  it("persists factual identity/tokens separately from M2 execution targets", () => {
    const scheme = createSpeffzScheme();
    const raw = [target("D:DR", "V"), target("F:UF", "I", true)];
    const presented = [target("D:DR", "V"), target("B:DB", "S", true)];
    expect(snapshot(raw, [{ pair: "VS", word: "verse" }], presented)).toEqual([
      {
        firstStickerId: "D:DR",
        secondStickerId: "F:UF",
        firstToken: "V",
        secondToken: "I",
        secondExecutionStickerId: "B:DB",
        secondExecutionToken: "S",
        mnemonic: "verse",
        firstCycleBreak: false,
        secondCycleBreak: true,
      },
    ]);
    expect(raw[1].stickerId).toBe("F:UF");
    expect(scheme.stickers[raw[1].stickerId].label).toBe("I");
  });
});
