import { Alg } from "cubing/alg";
import { puzzles } from "cubing/puzzles";
import { randomScrambleForEvent } from "cubing/scramble";
import { configureCubingSearchWorker } from "./configureCubingSearch";
import type { CubeOrbitState } from "./types";

configureCubingSearchWorker();

const faces = ["U", "L", "F", "R", "B", "D"];
export async function scrambleToState(
  scramble: string,
  orientation = { up: "U", front: "F" },
): Promise<CubeOrbitState> {
  const kpuzzle = await puzzles["3x3x3"].kpuzzle();
  const rotations = ["", "x", "x2", "x'", "z", "z'"].flatMap((a) =>
    ["", "y", "y2", "y'"].map((b) => `${a} ${b}`.trim()),
  );
  const scrambled = kpuzzle.defaultPattern().applyAlg(new Alg(scramble));
  const normalize = rotations.find((r) =>
    scrambled.applyAlg(r).patternData.CENTERS.pieces.every((p, i) => p === i),
  );
  const frame = rotations.find((r) => {
    const centers = kpuzzle.defaultPattern().applyAlg(r).patternData
      .CENTERS.pieces;
    return (
      faces[centers[0]] === orientation.up &&
      faces[centers[2]] === orientation.front
    );
  });
  if (normalize === undefined || frame === undefined)
    throw new Error("Invalid cube orientation");
  const pattern = kpuzzle
    .defaultPattern()
    .applyAlg(new Alg(frame).invert())
    .applyAlg(scramble)
    .applyAlg(normalize)
    .applyAlg(frame);
  const { EDGES, CORNERS } = pattern.patternData;
  return {
    EDGES: { pieces: [...EDGES.pieces], orientation: [...EDGES.orientation] },
    CORNERS: {
      pieces: [...CORNERS.pieces],
      orientation: [...CORNERS.orientation],
    },
  };
}

export async function generateBlindScramble() {
  return (await randomScrambleForEvent("333bf")).toString();
}
