import { describe, expect, it } from "vitest";
import { Alg } from "cubing/alg";
import { KPattern } from "cubing/kpuzzle";
import { puzzles } from "cubing/puzzles";
import { createSpeffzScheme } from "./speffz";
import { traceSection } from "./trace";
import {
  applyM2SecondTargetSwap,
  m2ExecutionRepresentation,
  m2SecondTargetStickerId,
} from "./memoConventions";
import type { CubeOrbitState, LetteringScheme, TraceSection } from "./types";
import {
  canonicalEdgeStickerToMethodId,
  inferM2OrientationFromBuffer,
  methodRelativeEdgeStickerId,
  orientationFaceMap,
  type CubeOrientation,
} from "./orientation";
import {
  applyM2Targets as applyTrainingM2Targets,
  trace as traceTraining,
} from "../../workspace/utils/bld";
import { stateFromScramble as trainingStateFromScramble } from "../../workspace/utils/cube";
import { EDGE_STICKERS, speffzScheme } from "../../workspace/utils/scheme";

const SETUP_TO_UB: Record<string, string> = {
  "U:UR": "R' U R U'",
  "R:UR": "B' R B",
  "B:BR": "U R' U'",
  "R:BR": "R B' R' B",
  "D:DR": "R' U R' U'",
  "R:DR": "B' R' B",
  "F:FR": "U R U'",
  "R:FR": "R B' R B",
  "U:UL": "L U' L' U",
  "L:UL": "B L' B'",
  "F:FL": "U' L' U",
  "L:FL": "L' B L' B'",
  "D:DL": "L U' L U",
  "L:DL": "B L B'",
  "B:BL": "U' L U",
  "L:BL": "L' B L B'",
  "U:UB": "",
  "B:UB": "B' R' B R' U R U'",
};

const SPECIAL: Record<string, string> = {
  "U:UF": "U2 M' U2 M'",
  "D:DB": "M U2 M U2",
  "F:UF": "F E R U R' E' R U' R' F' M2",
  "B:DB": "M2 D R' U R' U' M' U R U' M R D'",
};

const invert = (alg: string) => new Alg(alg).invert().toString();
const shot = (id: string) =>
  SPECIAL[id] ?? `${SETUP_TO_UB[id]} M2 ${invert(SETUP_TO_UB[id])}`;
const M2_OP_PARITY =
  "U' F2 U M2 U' F2 U y R U2 R' U2 R B' R' U' R U R B R2 U y'";

function canonicalTrace(
  state: CubeOrbitState,
  scheme: LetteringScheme,
): TraceSection {
  let choices: string[] = [];
  let traced = traceSection(state, scheme, "edge", choices);
  while (traced.status === "cycle-break") {
    choices = [...choices, traced.validCycleBreaks[0]];
    traced = traceSection(state, scheme, "edge", choices);
  }
  return traced;
}

function rng(seed: number) {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 0x1_0000_0000;
  };
}

function permutation(size: number, random: () => number) {
  const values = Array.from({ length: size }, (_, index) => index);
  for (let index = size - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [values[index], values[other]] = [values[other], values[index]];
  }
  return values;
}

function permutationParity(values: number[]) {
  let inversions = 0;
  for (let left = 0; left < values.length; left += 1) {
    for (let right = left + 1; right < values.length; right += 1) {
      if (values[left] > values[right]) inversions += 1;
    }
  }
  return inversions % 2;
}

function orientations(size: number, modulus: number, random: () => number) {
  const values = Array.from({ length: size }, () =>
    Math.floor(random() * modulus),
  );
  const sum = values.slice(0, -1).reduce((total, value) => total + value, 0);
  values[size - 1] = (modulus - (sum % modulus)) % modulus;
  return values;
}

function legalRandomPattern(
  kpuzzle: Awaited<ReturnType<(typeof puzzles)["3x3x3"]["kpuzzle"]>>,
  seed: number,
  edgesOnly = false,
) {
  const random = rng(seed);
  const cp = edgesOnly
    ? Array.from({ length: 8 }, (_, index) => index)
    : permutation(8, random);
  const ep = permutation(12, random);
  if (permutationParity(ep) !== permutationParity(cp))
    [ep[0], ep[1]] = [ep[1], ep[0]];
  return new KPattern(kpuzzle, {
    EDGES: { pieces: ep, orientation: orientations(12, 2, random) },
    CORNERS: {
      pieces: cp,
      orientation: edgesOnly
        ? new Array(8).fill(0)
        : orientations(8, 3, random),
    },
    CENTERS: {
      pieces: [0, 1, 2, 3, 4, 5],
      orientation: [0, 0, 0, 0, 0, 0],
      orientationMod: [1, 1, 1, 1, 1, 1],
    },
  });
}

function orbitState(pattern: KPattern): CubeOrbitState {
  return {
    EDGES: {
      pieces: [...pattern.patternData.EDGES.pieces],
      orientation: [...pattern.patternData.EDGES.orientation],
    },
    CORNERS: {
      pieces: [...pattern.patternData.CORNERS.pieces],
      orientation: [...pattern.patternData.CORNERS.orientation],
    },
  };
}

function executeM2(
  pattern: KPattern,
  targetIds: string[],
  needsParity: boolean,
) {
  const afterTargets = targetIds.reduce(
    (current, targetId) => current.applyAlg(shot(targetId)),
    pattern,
  );
  return needsParity ? afterTargets.applyAlg(M2_OP_PARITY) : afterTargets;
}

const CUBE_ROTATIONS = ["", "x", "x2", "x'", "z", "z'"]
  .flatMap((a) => ["", "y", "y2", "y'"].map((b) => `${a} ${b}`.trim()));
const CENTER_FACES = ["U", "L", "F", "R", "B", "D"];

function frameRotation(
  kpuzzle: Awaited<ReturnType<(typeof puzzles)["3x3x3"]["kpuzzle"]>>,
  orientation: CubeOrientation,
) {
  return CUBE_ROTATIONS.find((rotation) => {
    const centers = kpuzzle.defaultPattern().applyAlg(rotation).patternData.CENTERS.pieces;
    return (
      CENTER_FACES[centers[0]] === orientation.up &&
      CENTER_FACES[centers[2]] === orientation.front
    );
  });
}

function applyMethodAlg(pattern: KPattern, algorithm: string, frame: string) {
  return pattern
    .applyAlg(frame)
    .applyAlg(algorithm)
    .applyAlg(new Alg(frame).invert());
}

function executeOrientedM2(
  pattern: KPattern,
  targetIds: string[],
  needsParity: boolean,
  orientation: CubeOrientation,
  frame: string,
) {
  let current = pattern;
  for (const canonicalId of targetIds) {
    const methodId = canonicalEdgeStickerToMethodId(canonicalId, orientation);
    if (!methodId) throw new Error(`Invalid oriented target ${canonicalId}`);
    current = applyMethodAlg(current, shot(methodId), frame);
  }
  return needsParity ? applyMethodAlg(current, M2_OP_PARITY, frame) : current;
}

function expectEdgesSolved(actual: KPattern, solved: KPattern) {
  expect(actual.patternData.EDGES.pieces).toEqual(
    solved.patternData.EDGES.pieces,
  );
  expect(actual.patternData.EDGES.orientation).toEqual(
    solved.patternData.EDGES.orientation,
  );
}
describe("M2 execution audit", () => {
  it("solves the published no-parity example edge sequence", async () => {
    const kpuzzle = await puzzles["3x3x3"].kpuzzle();
    const scheme = createSpeffzScheme();
    const scramble =
      "B2 D2 F D' U2 R' B2 U L2 R' D2 L' U2 R' U B R2 D L F R2 U F D2 R2";
    const scrambled = kpuzzle.defaultPattern().applyAlg(scramble);
    const state = orbitState(scrambled);
    const raw = traceSection(state, scheme, "edge", ["U:UR"]);
    expect(raw.status).toBe("complete");
    const displayed = applyM2SecondTargetSwap(raw, scheme);
    const executed = displayed.targets.reduce(
      (pattern, target) => pattern.applyAlg(shot(target.stickerId)),
      scrambled,
    );
    expectEdgesSolved(executed, kpuzzle.defaultPattern());
  });

  it("solves the published parity example after the combined M2/OP parity algorithm", async () => {
    const kpuzzle = await puzzles["3x3x3"].kpuzzle();
    const scheme = createSpeffzScheme();
    const scramble =
      "D F' D R2 B2 U F L' F' L2 U2 L2 B R2 B' R U' D B R' F' D2 B' L' R2";
    const scrambled = kpuzzle.defaultPattern().applyAlg(scramble);
    const raw = canonicalTrace(orbitState(scrambled), scheme);
    expect(raw.targets.length % 2).toBe(1);
    const displayed = applyM2SecondTargetSwap(raw, scheme);
    let executed = displayed.targets.reduce(
      (pattern, target) => pattern.applyAlg(shot(target.stickerId)),
      scrambled,
    );
    executed = executed.applyAlg(M2_OP_PARITY);
    expectEdgesSolved(executed, kpuzzle.defaultPattern());
  });

  it("models the M2/Old Pochmann parity bridge as one edge swap and one corner swap", async () => {
    const kpuzzle = await puzzles["3x3x3"].kpuzzle();
    const solved = kpuzzle.defaultPattern();
    const parity = solved.applyAlg(M2_OP_PARITY);
    const changed = (pieces: number[]) =>
      pieces.filter((piece, index) => piece !== index).length;
    expect(changed(parity.patternData.EDGES.pieces)).toBe(2);
    expect(changed(parity.patternData.CORNERS.pieces)).toBe(2);
    expect(
      parity.patternData.EDGES.orientation.every((value) => value === 0),
    ).toBe(true);
    expect(
      parity.patternData.CORNERS.orientation.every((value) => value === 0),
    ).toBe(true);
  });

  it("solves 1,000 deterministic legal full states and 250 legal edges-only states", async () => {
    const kpuzzle = await puzzles["3x3x3"].kpuzzle();
    const solved = kpuzzle.defaultPattern();
    const scheme = createSpeffzScheme();
    const custom: LetteringScheme = {
      ...scheme,
      id: "audit-custom",
      name: "Audit custom",
      stickers: Object.fromEntries(
        Object.entries(scheme.stickers).map(([id, sticker], index) => [
          id,
          { ...sticker, label: `token-${index + 1}` },
        ]),
      ),
    };
    const coverage = {
      noCycleBreak: 0,
      oneCycleBreak: 0,
      multipleCycleBreaks: 0,
      flips: 0,
      specialPositions: Object.fromEntries(
        ["U:UF", "D:DB", "F:UF", "B:DB"].flatMap((id) => [
          [`${id}:odd`, 0],
          [`${id}:even`, 0],
        ]),
      ) as Record<string, number>,
      oddCounts: 0,
      evenCounts: 0,
      edgesOnly: 0,
    };

    for (let index = 0; index < 1_250; index += 1) {
      const edgesOnly = index >= 1_000;
      const pattern = legalRandomPattern(
        kpuzzle,
        0x5eed0000 + index,
        edgesOnly,
      );
      const state = orbitState(pattern);
      const raw = canonicalTrace(state, scheme);
      const rawBefore = structuredClone(raw.targets);
      const off = m2ExecutionRepresentation(raw, scheme, false);
      const on = m2ExecutionRepresentation(raw, scheme, true);
      const converted = { ...raw, targets: on.executionTargets };
      const customRaw = canonicalTrace(state, custom);
      const customConverted = applyM2SecondTargetSwap(customRaw, custom);
      const manualIds = raw.targets.map((target, targetIndex) =>
        targetIndex % 2 === 1
          ? ((
              {
                "U:UF": "D:DB",
                "D:DB": "U:UF",
                "F:UF": "B:DB",
                "B:DB": "F:UF",
              } as Record<string, string>
            )[target.stickerId] ?? target.stickerId)
          : target.stickerId,
      );
      const convertedIds = converted.targets.map((target) => target.stickerId);
      const customIds = customConverted.targets.map(
        (target) => target.stickerId,
      );

      expect(on.rawTargets).toEqual(off.rawTargets);
      expect(on.rawTargets).toEqual(rawBefore);
      expect(raw.targets).toEqual(rawBefore);
      expect(on.hasM2Parity).toBe(raw.targets.length % 2 === 1);
      expect(convertedIds).toEqual(manualIds);
      expect(customIds).toEqual(manualIds);
      expect(customConverted.targets.map((target) => target.token)).toEqual(
        customIds.map((id) => custom.stickers[id].label),
      );
      const executed = executeM2(
        pattern,
        convertedIds,
        raw.targets.length % 2 === 1,
      );
      if (
        JSON.stringify(executed.patternData.EDGES) !==
        JSON.stringify(solved.patternData.EDGES)
      ) {
        throw new Error(
          JSON.stringify({
            index,
            edgesOnly,
            edgeState: state.EDGES,
            raw: raw.targets,
            convertedIds,
            executed: executed.patternData.EDGES,
          }),
        );
      }

      const breaks = raw.targets.filter((target) => target.cycleBreak).length;
      if (breaks === 0) coverage.noCycleBreak += 1;
      else if (breaks === 1) coverage.oneCycleBreak += 1;
      else coverage.multipleCycleBreaks += 1;
      coverage.flips += state.EDGES.orientation.filter(Boolean).length;
      raw.targets.forEach((target, targetIndex) => {
        if (!["U:UF", "D:DB", "F:UF", "B:DB"].includes(target.stickerId))
          return;
        coverage.specialPositions[
          `${target.stickerId}:${targetIndex % 2 === 1 ? "even" : "odd"}`
        ] += 1;
      });
      if (raw.targets.length % 2 === 1) coverage.oddCounts += 1;
      else coverage.evenCounts += 1;
      if (edgesOnly) coverage.edgesOnly += 1;
    }

    expect(coverage).toMatchObject({ edgesOnly: 250 });
    expect(coverage.noCycleBreak).toBeGreaterThan(0);
    expect(coverage.oneCycleBreak).toBeGreaterThan(0);
    expect(coverage.multipleCycleBreaks).toBeGreaterThan(0);
    expect(coverage.flips).toBeGreaterThan(0);
    Object.values(coverage.specialPositions).forEach((count) =>
      expect(count).toBeGreaterThan(0),
    );
    expect(coverage.oddCounts).toBeGreaterThan(0);
    expect(coverage.evenCounts).toBeGreaterThan(0);
    expect(coverage).toMatchInlineSnapshot(`
      {
        "edgesOnly": 250,
        "evenCounts": 747,
        "flips": 7488,
        "multipleCycleBreaks": 668,
        "noCycleBreak": 155,
        "oddCounts": 503,
        "oneCycleBreak": 427,
        "specialPositions": {
          "B:DB:even": 292,
          "B:DB:odd": 334,
          "D:DB:even": 306,
          "D:DB:odd": 327,
          "F:UF:even": 314,
          "F:UF:odd": 318,
          "U:UF:even": 382,
          "U:UF:odd": 418,
        },
      }
    `);
  }, 30_000);

  it("solves deterministic physical edge states in all 24 M2 execution orientations", async () => {
    const kpuzzle = await puzzles["3x3x3"].kpuzzle();
    const solved = kpuzzle.defaultPattern();
    const orientations: CubeOrientation[] = [];
    for (const up of "UDLRFB")
      for (const front of "UDLRFB")
        if (orientationFaceMap({ up, front })) orientations.push({ up, front });

    for (const [orientationIndex, orientation] of orientations.entries()) {
      const frame = frameRotation(kpuzzle, orientation);
      expect(frame, JSON.stringify(orientation)).not.toBeUndefined();
      const scheme = createSpeffzScheme();
      scheme.edgeBuffer = methodRelativeEdgeStickerId("D:DF", orientation)!;
      const inferred = inferM2OrientationFromBuffer(scheme.edgeBuffer);
      expect(inferred).toEqual(orientation);
      for (const [index, sticker] of Object.entries(scheme.stickers))
        sticker.label = `custom-${orientationIndex}-${index}`;

      for (let sample = 0; sample < 20; sample += 1) {
        const pattern = legalRandomPattern(
          kpuzzle,
          0x0a110000 + orientationIndex * 100 + sample,
          true,
        );
        const raw = canonicalTrace(orbitState(pattern), scheme);
        const rawBefore = structuredClone(raw.targets);
        const execution = m2ExecutionRepresentation(raw, scheme, true);
        expect(execution.rawTargets).toEqual(rawBefore);
        expect(raw.targets).toEqual(rawBefore);
        expect(
          execution.executionTargets.map((target) => target.token),
        ).toEqual(
          execution.executionTargets.map(
            (target) => scheme.stickers[target.stickerId].label,
          ),
        );
        expectEdgesSolved(
          executeOrientedM2(
            pattern,
            execution.executionTargets.map((target) => target.stickerId),
            execution.hasM2Parity,
            inferred!,
            frame!,
          ),
          solved,
        );
      }
    }
  }, 30_000);

  it("maps only global even-numbered shots and never resets at a cycle break", () => {
    const ids = ["U:UF", "U:UF", "F:UF", "F:UF", "D:DB"];
    expect(ids.map((id, index) => m2SecondTargetStickerId(id, index))).toEqual([
      "U:UF",
      "D:DB",
      "F:UF",
      "B:DB",
      "D:DB",
    ]);
  });

  it("solves two in-place flipped edges without a separate flip fiction", async () => {
    const kpuzzle = await puzzles["3x3x3"].kpuzzle();
    const solved = kpuzzle.defaultPattern();
    const pattern = new KPattern(kpuzzle, {
      ...solved.patternData,
      EDGES: {
        pieces: [...solved.patternData.EDGES.pieces],
        orientation: [1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      },
    });
    const scheme = createSpeffzScheme();
    const raw = canonicalTrace(orbitState(pattern), scheme);
    const ids = applyM2SecondTargetSwap(raw, scheme).targets.map(
      (target) => target.stickerId,
    );
    expectEdgesSolved(
      executeM2(pattern, ids, raw.targets.length % 2 === 1),
      solved,
    );
  });

  it("keeps three human-verifiable regression sequences physically executable", async () => {
    const kpuzzle = await puzzles["3x3x3"].kpuzzle();
    const solved = kpuzzle.defaultPattern();
    const scheme = createSpeffzScheme();
    const scrambles = [
      "B2 D2 F D' U2 R' B2 U L2 R' D2 L' U2 R' U B R2 D L F R2 U F D2 R2",
      "D F' D R2 B2 U F L' F' L2 U2 L2 B R2 B' R U' D B R' F' D2 B' L' R2",
      "B' R' B' U' F L' U F2 L F R' D' R' B D F2 L2 D' R2 D'",
    ];
    const summaries = scrambles.map((scramble) => {
      const pattern = solved.applyAlg(scramble);
      const raw = canonicalTrace(orbitState(pattern), scheme);
      const displayed = applyM2SecondTargetSwap(raw, scheme);
      expectEdgesSolved(
        executeM2(
          pattern,
          displayed.targets.map((target) => target.stickerId),
          raw.targets.length % 2 === 1,
        ),
        solved,
      );
      return {
        scramble,
        rawPhysical: raw.targets.map((target) => target.stickerId).join(" "),
        rawTokens: raw.targets.map((target) => target.token).join(" "),
        substitutions: raw.targets.flatMap((target, index) => {
          const mapped = displayed.targets[index];
          return mapped.stickerId === target.stickerId
            ? []
            : [`${index + 1}:${target.stickerId}->${mapped.stickerId}`];
        }),
        autoSwapTokens: displayed.targets
          .map((target) => target.token)
          .join(" "),
        parity: raw.targets.length % 2 === 1,
      };
    });
    expect(summaries).toMatchInlineSnapshot(`
      [
        {
          "autoSwapTokens": "R J C Q T L G O W B D M",
          "parity": false,
          "rawPhysical": "B:BL F:FR U:UF B:UB B:BR F:FL L:DL R:DR D:DB U:UR U:UL R:UR",
          "rawTokens": "R J C Q T L G O W B D M",
          "scramble": "B2 D2 F D' U2 R' B2 U L2 R' D2 L' U2 R' U B R2 D L F R2 U F D2 R2",
          "substitutions": [],
        },
        {
          "autoSwapTokens": "J B N A Q W E I O R F X I",
          "parity": true,
          "rawPhysical": "F:FR U:UR R:BR U:UB B:UB U:UF L:UL B:DB R:DR B:BL L:FL D:DL F:UF",
          "rawTokens": "J B N A Q C E S O R F X I",
          "scramble": "D F' D R2 B2 U F L' F' L2 U2 L2 B R2 B' R U' D B R' F' D2 B' L' R2",
          "substitutions": [
            "6:U:UF->D:DB",
            "8:B:DB->F:UF",
          ],
        },
        {
          "autoSwapTokens": "J D N W G M A V W L",
          "parity": false,
          "rawPhysical": "F:FR U:UL R:BR U:UF L:DL R:UR U:UB D:DR D:DB F:FL",
          "rawTokens": "J D N C G M A V W L",
          "scramble": "B' R' B' U' F L' U F2 L F R' D' R' B D F2 L2 D' R2 D'",
          "substitutions": [
            "4:U:UF->D:DB",
          ],
        },
      ]
    `);
  });

  it("keeps the training facelet adapter consistent with the canonical physical trace", async () => {
    const kpuzzle = await puzzles["3x3x3"].kpuzzle();
    const scheme = createSpeffzScheme();
    const trainingScheme = speffzScheme();
    const bufferToken = scheme.stickers[scheme.edgeBuffer].label;
    const trainingBuffer = EDGE_STICKERS.find(
      (sticker) => trainingScheme[sticker.id] === bufferToken,
    )!.id;
    const setup = {
      scheme: trainingScheme,
      edgeBuffer: trainingBuffer,
      cornerBuffer: "U0",
      edgeMethod: "m2",
      m2SecondTargetSwap: true,
    };
    const faces = ["U", "D", "R", "L", "F", "B"];
    const suffixes = ["", "'", "2"];
    const random = rng(0xc0ffee);
    for (let sample = 0; sample < 250; sample += 1) {
      const moves: string[] = [];
      let previous = "";
      for (let count = 0; count < 24; count += 1) {
        const available = faces.filter((face) => face !== previous);
        const face = available[Math.floor(random() * available.length)];
        moves.push(face + suffixes[Math.floor(random() * suffixes.length)]);
        previous = face;
      }
      const scramble = moves.join(" ");
      const domainRaw = canonicalTrace(
        orbitState(kpuzzle.defaultPattern().applyAlg(scramble)),
        scheme,
      );
      const domainTokens = applyM2SecondTargetSwap(
        domainRaw,
        scheme,
      ).targets.map((target) => target.token);
      const trainingRaw = traceTraining(
        trainingStateFromScramble(scramble),
        "edge",
        trainingBuffer,
      ).ids;
      const trainingTokens = applyTrainingM2Targets(trainingRaw, setup).map(
        (id) => trainingScheme[id],
      );
      expect(trainingTokens, scramble).toEqual(domainTokens);
    }
  });
});
