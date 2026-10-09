import { describe, expect, it } from "vitest";
import { validateCubeState } from "../../domain/bld/trace";
import {
  applyM2Targets,
  makeChallenge,
  randomState,
  seededRandom,
} from "./bld";
import { EDGE_STICKERS, speffzScheme } from "./scheme";
import { tokenize } from "./pairs";

const setup = {
  scheme: speffzScheme(),
  edgeBuffer: EDGE_STICKERS.find(
    (sticker) => sticker.face === "D" && sticker.piece === "DF",
  )!.id,
  cornerBuffer: "U8",
  orientation: { up: "U" as const, front: "F" as const },
};

describe("Magic training state adapter", () => {
  it("applies M2 second-target swaps by physical sticker with custom labels", () => {
    const id = (face: string, piece: string) =>
      EDGE_STICKERS.find((s) => s.face === face && s.piece === piece)!.id;
    const scheme = speffzScheme();
    scheme[id("F", "FU")] = "E";
    scheme[id("B", "BD")] = "O";
    const raw = [id("D", "DR"), id("F", "FU")];
    const configured = {
      scheme,
      edgeBuffer: setup.edgeBuffer,
      cornerBuffer: "U8",
      edgeMethod: "m2",
      m2SecondTargetSwap: true,
      orientation: setup.orientation,
    };
    expect(
      applyM2Targets(raw, configured).map((sticker) => scheme[sticker]),
    ).toEqual(["V", "O"]);
    expect(raw.map((sticker) => scheme[sticker])).toEqual(["V", "E"]);
  });

  it("maps white-top orange-front M2 specials before resolving custom tokens", () => {
    const id = (face: string, piece: string) =>
      EDGE_STICKERS.find((s) => s.face === face && s.piece === piece)!.id;
    const scheme = speffzScheme();
    scheme[id("L", "LU")] = "EDGE-E";
    scheme[id("R", "RD")] = "EDGE-O";
    const configured = {
      scheme,
      edgeBuffer: id("D", "DL"),
      cornerBuffer: "U8",
      edgeMethod: "m2",
      m2SecondTargetSwap: true,
      orientation: { up: "U" as const, front: "L" as const },
    };
    const raw = [id("D", "DL"), id("L", "LU")];
    expect(applyM2Targets(raw, configured)).toEqual([
      id("D", "DL"),
      id("R", "RD"),
    ]);
    expect(
      applyM2Targets(raw, configured).map((sticker) => scheme[sticker]),
    ).toEqual([scheme[id("D", "DL")], "EDGE-O"]);
  });
  it.each(["corners", "edges", "both"] as const)(
    "generates legal %s states",
    (filter) => {
      for (let seed = 1; seed <= 30; seed++) {
        const state = randomState(filter, seededRandom(seed));
        expect(
          validateCubeState({
            EDGES: { pieces: state.ep, orientation: state.eo },
            CORNERS: { pieces: state.cp, orientation: state.co },
          }).legal,
        ).toBe(true);
      }
    },
  );

  it("solves the orbit outside the selected practice scope", () => {
    const corners = randomState("corners", seededRandom(41));
    expect(corners.ep).toEqual([...Array(12).keys()]);
    expect(corners.eo).toEqual(Array(12).fill(0));
    const edges = randomState("edges", seededRandom(42));
    expect(edges.cp).toEqual([...Array(8).keys()]);
    expect(edges.co).toEqual(Array(8).fill(0));
  });

  it("derives displayed facelets and target tokens from one challenge", () => {
    const challenge = makeChallenge("both", 9472, setup);
    expect(challenge.rawTargets.corners.tokens.length).toBeGreaterThan(1);
    expect(challenge.rawTargets.edges.tokens.length).toBeGreaterThan(1);
    expect(Object.values(challenge.state).flat()).toHaveLength(54);
    expect(
      [
        ...challenge.rawTargets.corners.tokens,
        ...challenge.rawTargets.edges.tokens,
      ].every((token) => /^[A-X]$/.test(token)),
    ).toBe(true);
    expect(challenge.hasM2Parity).toBe(false);
  });

  it("marks odd target-by-target M2 sequences without changing their targets", () => {
    const m2 = { ...setup, edgeMethod: "m2" };
    const raw = Array.from({ length: 100 }, (_, seed) =>
      makeChallenge("both", seed + 1, m2),
    ).find((challenge) => challenge.rawTargets.edges.tokens.length % 2 === 1)!;
    expect(raw.hasM2Parity).toBe(true);
    expect(
      makeChallenge("both", raw.seed, { ...m2, edgeMethod: "op" }).hasM2Parity,
    ).toBe(false);
  });

  it("honours multi-character custom tokens and explicit boundaries", () => {
    expect(tokenize("CH·A|SH", ["A", "C", "CH", "S", "SH"])).toEqual([
      "CH",
      "A",
      "SH",
    ]);
  });
});
