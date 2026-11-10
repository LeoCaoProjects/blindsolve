import { describe, it, expect } from "vitest";
import { challengeFromScramble, homeSticker, makeChallenge } from "./bld";
import { recognitionSteps, recognitionPieceStickers } from "./recognition";
import { ALL_STICKERS, speffzScheme } from "./scheme";
import { bestRotation, faceDepth } from "./camera";
import type { Face } from "./cube";
const setup = {
  scheme: speffzScheme(),
  edgeBuffer: "D1",
  cornerBuffer: "U8",
  edgeMethod: "m2",
  m2SecondTargetSwap: true,
};
describe("recognition observations", () => {
  for (const scope of ["edges", "corners", "both"] as const)
    it(`follows genuine ${scope} reconstruction and skips synthetic breaks`, () => {
      const c = challengeFromScramble(
        "R U2 F' L2 D B2 R' U F2 D' L B'",
        scope,
        1,
        setup,
      );
      const steps = recognitionSteps(c, setup, "edges-first", scope);
      expect(steps.length).toBeGreaterThan(0);
      expect(steps.length).toBe(
        c.rawTargets.edges.tokens.length +
          c.rawTargets.corners.tokens.length -
          c.edgeBreaks.length -
          c.cornerBreaks.length,
      );
      for (const step of steps) {
        expect(step.expected).toBe(
          setup.scheme[homeSticker(c.state, step.source)!],
        );
        expect(recognitionPieceStickers(step.source)).toHaveLength(
          step.piece === "edges" ? 2 : 3,
        );
        if (scope !== "both") expect(step.piece).toBe(scope);
      }
      if (scope === "both") expect(steps[0].piece).toBe("edges");
    });
  it("keeps raw M2 answers and atomic custom labels through cycles and rotated buffers", () => {
    const scheme = Object.fromEntries(
      ALL_STICKERS.map((s, i) => [
        s.id,
        i === 0 ? "S" : i === 1 ? "SH" : `X${i}`,
      ]),
    );
    const configured = {
      ...setup,
      scheme,
      edgeBuffer: "D3",
      cornerBuffer: "B2",
    };
    let breaks = 0,
      swaps = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const c = makeChallenge("both", seed, configured);
      breaks += c.edgeBreaks.length + c.cornerBreaks.length;
      swaps += Number(
        JSON.stringify(c.rawTargets) !== JSON.stringify(c.executionTargets),
      );
      for (const step of recognitionSteps(
        c,
        configured,
        "corners-first",
        "both",
      ))
        expect(step.expected).toBe(scheme[homeSticker(c.state, step.source)!]);
    }
    expect(breaks).toBeGreaterThan(0);
    expect(swaps).toBeGreaterThan(0);
  });
  it("reveals all partner colours in configured camera orientations", () => {
    for (const view of [
      { top: "white", front: "green" },
      { top: "blue", front: "yellow" },
      { top: "white", front: "orange" },
    ] as const)
      for (const s of ALL_STICKERS) {
        const faces = recognitionPieceStickers(s.id).map((id) => id[0] as Face);
        const { rot, hidden } = bestRotation(faces, view);
        expect(hidden).toEqual([]);
        for (const f of faces)
          expect(faceDepth(f, rot, view)).toBeGreaterThan(0.2);
      }
  });
});
