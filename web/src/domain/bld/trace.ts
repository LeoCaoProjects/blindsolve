import type {
  CubeOrbitState,
  LetteringScheme,
  MemoTrace,
  PieceType,
  TraceSection,
  TraceTarget,
} from "./types";
import { findSticker, stickersFor } from "./speffz";
const orbitFor = (state: CubeOrbitState, type: PieceType) =>
  type === "edge" ? state.EDGES : state.CORNERS;
const mod = (n: number, m: number) => ((n % m) + m) % m;

/** Home identity of the sticker occupying a location, in cubing.js orientation conventions. */
export function occupantHomeSticker(
  state: CubeOrbitState,
  scheme: LetteringScheme,
  locationStickerId: string,
) {
  const location = scheme.stickers[locationStickerId];
  if (!location) throw new Error(`Unknown sticker ${locationStickerId}`);
  const orbit = orbitFor(state, location.pieceType);
  const orientation = mod(
    location.orientationIndex - orbit.orientation[location.pieceIndex],
    location.pieceType === "edge" ? 2 : 3,
  );
  const sticker = findSticker(
    scheme,
    location.pieceType,
    orbit.pieces[location.pieceIndex],
    orientation,
  );
  if (!sticker) throw new Error("Incomplete lettering scheme");
  return sticker;
}

/** Abstract buffer swaps, not execution algorithms. Breaks include entry and closure. */
export function traceSection(
  state: CubeOrbitState,
  scheme: LetteringScheme,
  type: PieceType,
  cycleBreaks: string[] = [],
): TraceSection {
  const buffer =
    scheme.stickers[type === "edge" ? scheme.edgeBuffer : scheme.cornerBuffer];
  if (!buffer || buffer.pieceType !== type)
    throw new Error(`Invalid ${type} buffer`);
  const work = structuredClone(state),
    orbit = orbitFor(work, type);
  const targets: TraceTarget[] = [],
    modulus = type === "edge" ? 2 : 3;
  let breakIndex = 0;
  for (let guard = 0; guard < 100; guard++) {
    const unsolved = orbit.pieces
      .map((p, i) =>
        i !== buffer.pieceIndex && (p !== i || orbit.orientation[i] !== 0)
          ? i
          : -1,
      )
      .filter((i) => i >= 0);
    const visitedPieces = orbit.pieces
      .map((_, i) => i)
      .filter((i) => !unsolved.includes(i));
    if (!unsolved.length)
      return {
        pieceType: type,
        status: "complete",
        targets,
        visitedPieces,
        validCycleBreaks: [],
      };
    let target = occupantHomeSticker(work, scheme, buffer.id);
    const cycleBreak = target.pieceIndex === buffer.pieceIndex;
    if (cycleBreak) {
      const valid = stickersFor(scheme, type)
        .filter((s) => unsolved.includes(s.pieceIndex))
        .map((s) => s.id);
      const choice = cycleBreaks[breakIndex++];
      if (!choice)
        return {
          pieceType: type,
          status: "cycle-break",
          targets,
          visitedPieces,
          validCycleBreaks: valid,
        };
      if (!valid.includes(choice))
        throw new Error(`Invalid cycle break: ${choice}`);
      target = scheme.stickers[choice];
    }
    targets.push({
      stickerId: target.id,
      pieceIndex: target.pieceIndex,
      token: target.label,
      cycleBreak,
    });
    const b = buffer.pieceIndex,
      t = target.pieceIndex;
    [orbit.pieces[b], orbit.pieces[t]] = [orbit.pieces[t], orbit.pieces[b]];
    const bo = orbit.orientation[b],
      to = orbit.orientation[t];
    orbit.orientation[t] = mod(
      bo + target.orientationIndex - buffer.orientationIndex,
      modulus,
    );
    orbit.orientation[b] = mod(
      to + buffer.orientationIndex - target.orientationIndex,
      modulus,
    );
  }
  throw new Error(
    "Trace did not converge. Check the cube state and lettering scheme.",
  );
}
export function traceMemo(
  state: CubeOrbitState,
  scheme: LetteringScheme,
  choices?: { edges?: string[]; corners?: string[] },
): MemoTrace {
  return {
    edges: traceSection(state, scheme, "edge", choices?.edges),
    corners: traceSection(state, scheme, "corner", choices?.corners),
  };
}
export function traceWithCanonicalBreaks(
  state: CubeOrbitState,
  scheme: LetteringScheme,
) {
  const choices = { edges: [] as string[], corners: [] as string[] };
  for (const key of ["edges", "corners"] as const)
    for (let guard = 0; guard < 20; guard++) {
      const section = traceSection(
        state,
        scheme,
        key === "edges" ? "edge" : "corner",
        choices[key],
      );
      if (section.status === "complete") break;
      choices[key].push(section.validCycleBreaks[0]);
    }
  return { trace: traceMemo(state, scheme, choices), choices };
}
export function validateCubeState(state: CubeOrbitState) {
  const edgeFlip = state.EDGES.orientation.reduce((a, b) => a + b, 0) % 2;
  const cornerTwist = state.CORNERS.orientation.reduce((a, b) => a + b, 0) % 3;
  const validOrbit = (p: number[], o: number[], n: number, m: number) =>
    p.length === n &&
    o.length === n &&
    new Set(p).size === n &&
    p.every((x) => Number.isInteger(x) && x >= 0 && x < n) &&
    o.every((x) => Number.isInteger(x) && x >= 0 && x < m);
  const parity = (p: number[]) =>
    p.reduce((n, x, i) => n + p.slice(i + 1).filter((y) => x > y).length, 0) %
    2;
  return {
    legal:
      validOrbit(state.EDGES.pieces, state.EDGES.orientation, 12, 2) &&
      validOrbit(state.CORNERS.pieces, state.CORNERS.orientation, 8, 3) &&
      edgeFlip === 0 &&
      cornerTwist === 0 &&
      parity(state.EDGES.pieces) === parity(state.CORNERS.pieces),
    edgeFlip,
    cornerTwist,
  };
}
