import { describe, expect, it } from "vitest";
import { challengeFromScramble } from "./bld";
import { CORNER_STICKERS, EDGE_STICKERS, speffzScheme } from "./scheme";
import {
  challengeTargetsForMode,
  orderedChallengeGroups,
} from "./challengeTargets";

const SPECIAL_SCRAMBLE =
  "D F' D R2 B2 U F L' F' L2 U2 L2 B R2 B' R U' D B R' F' D2 B' L' R2";

function sticker(face: string, piece: string) {
  return EDGE_STICKERS.find(
    (candidate) => candidate.face === face && candidate.piece === piece,
  )!.id;
}

function setup(swap: boolean) {
  const scheme = speffzScheme();
  return {
    scheme,
    edgeBuffer: EDGE_STICKERS.find((candidate) => scheme[candidate.id] === "U")!
      .id,
    cornerBuffer: CORNER_STICKERS.find(
      (candidate) => scheme[candidate.id] === "E",
    )!.id,
    edgeMethod: "m2",
    m2SecondTargetSwap: swap,
  };
}

describe("raw and execution challenge separation", () => {
  it("keeps raw physical targets and cycle breaks identical with auto-swap off/on", () => {
    const off = challengeFromScramble(
      SPECIAL_SCRAMBLE,
      "both",
      1,
      setup(false),
    );
    const on = challengeFromScramble(SPECIAL_SCRAMBLE, "both", 1, setup(true));

    expect(on.rawTargets).toEqual(off.rawTargets);
    expect(on.cornerBreaks).toEqual(off.cornerBreaks);
    expect(on.edgeBreaks).toEqual(off.edgeBreaks);
    expect(on.hasM2Parity).toBe(off.hasM2Parity);
    expect(on.executionTargets.edges.physicalStickerIds).not.toEqual(
      off.executionTargets.edges.physicalStickerIds,
    );
    expect(on.executionTargets.corners).toEqual(off.executionTargets.corners);
    expect(on.executionTargets.corners.physicalStickerIds).not.toBe(
      on.rawTargets.corners.physicalStickerIds,
    );
    expect(on.executionTargets.edges.physicalStickerIds).not.toBe(
      on.rawTargets.edges.physicalStickerIds,
    );
    expect(on.rawTargets.edges.tokens).toEqual([
      "J",
      "B",
      "N",
      "A",
      "Q",
      "C",
      "E",
      "S",
      "O",
      "R",
      "F",
      "X",
      "I",
    ]);
    expect(on.executionTargets.edges.tokens).toEqual([
      "J",
      "B",
      "N",
      "A",
      "Q",
      "W",
      "E",
      "I",
      "O",
      "R",
      "F",
      "X",
      "I",
    ]);
  });

  it("uses raw targets for tracing/memo modes and execution targets only for Execution Sprint", () => {
    const challenge = challengeFromScramble(
      SPECIAL_SCRAMBLE,
      "both",
      1,
      setup(true),
    );
    for (const mode of ["trace", "recall", "full"] as const) {
      expect(challengeTargetsForMode(challenge, mode)).toBe(
        challenge.rawTargets,
      );
    }
    expect(challengeTargetsForMode(challenge, "exec")).toBe(
      challenge.executionTargets,
    );
  });

  it("maps the known special targets physically before custom token lookup", () => {
    const custom = setup(true);
    custom.scheme[sticker("U", "UF")] = "ALPHA";
    custom.scheme[sticker("D", "DB")] = "7X";
    custom.scheme[sticker("B", "BD")] = "BAR-2";
    custom.scheme[sticker("F", "FU")] = "foo";
    const challenge = challengeFromScramble(
      SPECIAL_SCRAMBLE,
      "both",
      1,
      custom,
    );

    expect(challenge.rawTargets.edges.physicalStickerIds[5]).toBe(
      sticker("U", "UF"),
    );
    expect(challenge.rawTargets.edges.tokens[5]).toBe("ALPHA");
    expect(challenge.executionTargets.edges.physicalStickerIds[5]).toBe(
      sticker("D", "DB"),
    );
    expect(challenge.executionTargets.edges.tokens[5]).toBe("7X");
  });

  it("lets memo order reorder sections without changing either trace or parity", () => {
    const challenge = challengeFromScramble(
      SPECIAL_SCRAMBLE,
      "both",
      1,
      setup(true),
    );
    const before = structuredClone(challenge);
    const cornersFirst = orderedChallengeGroups(
      challenge,
      "trace",
      "both",
      "corners-first",
    );
    const edgesFirst = orderedChallengeGroups(
      challenge,
      "trace",
      "both",
      "edges-first",
    );
    expect(cornersFirst.map((group) => group.piece)).toEqual([
      "corners",
      "edges",
    ]);
    expect(edgesFirst.map((group) => group.piece)).toEqual([
      "edges",
      "corners",
    ]);
    expect(challenge).toEqual(before);
  });
});
