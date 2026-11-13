import { describe, it, expect } from "vitest";
import { createSpeffzScheme } from "../../domain/bld/speffz";
import { scrambleToState } from "../../domain/bld/cubing";
import { traceSection, traceWithCanonicalBreaks } from "../../domain/bld/trace";
import type {
  CubeOrbitState,
  LetteringScheme,
  PieceType,
} from "../../domain/bld/types";
import { compareTraceGroups } from "./traceValidation";
import { compareGroups } from "./training";
const scheme = createSpeffzScheme();
function paths(
  state: CubeOrbitState,
  scheme: LetteringScheme,
  type: PieceType,
  choices: string[] = [],
): string[][] {
  const section = traceSection(state, scheme, type, choices);
  if (section.status === "complete")
    return [section.targets.map((t) => t.token)];
  // Exercise all sticker orientations at this break, then a different choice at later breaks.
  return section.validCycleBreaks.flatMap((id) => {
    const selected = [...choices, id];
    for (let guard = 0; guard < 30; guard++) {
      const result = traceSection(state, scheme, type, selected);
      if (result.status === "complete")
        return [result.targets.map((t) => t.token)];
      selected.push(result.validCycleBreaks.at(-1)!);
    }
    throw new Error("fixture trace failed");
  });
}
const vocabulary = (scheme: LetteringScheme) => [
  ...new Set(Object.values(scheme.stickers).map((s) => s.label)),
];
const groups = [
  { piece: "corners" as const, tokens: [] },
  { piece: "edges" as const, tokens: [] },
];
describe("Trace Sprint submitted cycle breaks", () => {
  it("accepts every first-break sticker choice across edge/corner cycles, flips and twists", async () => {
    const state = await scrambleToState("");
    const edgeBuffer = scheme.stickers[scheme.edgeBuffer].pieceIndex,
      cornerBuffer = scheme.stickers[scheme.cornerBuffer].pieceIndex;
    const edges = state.EDGES.pieces.filter((i) => i !== edgeBuffer),
      corners = state.CORNERS.pieces.filter((i) => i !== cornerBuffer);
    for (const [orbit, indices] of [
      [state.EDGES, edges],
      [state.CORNERS, corners],
    ] as const) {
      [orbit.pieces[indices[0]], orbit.pieces[indices[1]]] = [
        orbit.pieces[indices[1]],
        orbit.pieces[indices[0]],
      ];
      [orbit.pieces[indices[2]], orbit.pieces[indices[3]]] = [
        orbit.pieces[indices[3]],
        orbit.pieces[indices[2]],
      ];
    }
    state.EDGES.orientation[edges[4]] = 1;
    state.EDGES.orientation[edges[5]] = 1;
    state.CORNERS.orientation[corners[4]] = 1;
    state.CORNERS.orientation[corners[5]] = 2;
    const cornerPaths = paths(state, scheme, "corner"),
      edgePaths = paths(state, scheme, "edge");
    expect(cornerPaths.length).toBeGreaterThan(3);
    expect(edgePaths.length).toBeGreaterThan(3);
    for (const tokens of cornerPaths)
      expect(
        compareTraceGroups(
          state,
          scheme,
          [groups[0]],
          [tokens.join("")],
          vocabulary(scheme),
        )[0].correct,
      ).toBe(true);
    for (const tokens of edgePaths)
      expect(
        compareTraceGroups(
          state,
          scheme,
          [groups[1]],
          [tokens.join("")],
          vocabulary(scheme),
        )[0].correct,
      ).toBe(true);
    const canonical = traceWithCanonicalBreaks(state, scheme).trace;
    const alternate = cornerPaths.find(
      (tokens) =>
        tokens.join("") !==
        canonical.corners.targets.map((t) => t.token).join(""),
    )!;
    expect(
      compareGroups(
        [
          {
            piece: "corners",
            tokens: canonical.corners.targets.map((t) => t.token),
          },
        ],
        [alternate.join("")],
        vocabulary(scheme),
      )[0].correct,
    ).toBe(false);
    expect(
      compareTraceGroups(
        state,
        scheme,
        [groups[0]],
        [alternate.join("")],
        vocabulary(scheme),
      )[0].correct,
    ).toBe(true);
  });
  it("rejects missing, extra, incorrect and premature-break targets", async () => {
    const state = await scrambleToState("R U R' F2 D L2 B U2 F'");
    const valid = paths(state, scheme, "edge")[0];
    for (const tokens of [
      valid.slice(0, -1),
      [...valid, valid[0]],
      ["Z", ...valid.slice(1)],
      [],
    ])
      expect(
        compareTraceGroups(
          state,
          scheme,
          [groups[1]],
          [tokens.join("")],
          vocabulary(scheme),
        )[0].correct,
      ).toBe(false);
    // Same target multiset in the wrong order must never pass.
    const shuffled = [...valid].reverse();
    expect(shuffled).not.toEqual(valid);
    expect(
      compareTraceGroups(
        state,
        scheme,
        [groups[1]],
        [shuffled.join("")],
        vocabulary(scheme),
      )[0].correct,
    ).toBe(false);
  });
  it("rejects choosing a solved piece/buffer at a real break and requires cycle closure", async () => {
    const state = await scrambleToState("");
    const ids = state.EDGES.pieces.filter(
      (i) => i !== scheme.stickers[scheme.edgeBuffer].pieceIndex,
    );
    [
      state.EDGES.pieces[ids[0]],
      state.EDGES.pieces[ids[1]],
      state.EDGES.pieces[ids[2]],
    ] = [ids[1], ids[2], ids[0]];
    const valid = paths(state, scheme, "edge")[0];
    const solved = Object.values(scheme.stickers).find(
      (s) => s.pieceType === "edge" && s.pieceIndex === ids[3],
    )!.label;
    for (const tokens of [
      [solved, ...valid.slice(1)],
      [scheme.stickers[scheme.edgeBuffer].label, ...valid.slice(1)],
      valid.slice(0, -1),
    ])
      expect(
        compareTraceGroups(
          state,
          scheme,
          [groups[1]],
          [tokens.join("")],
          vocabulary(scheme),
        )[0].correct,
      ).toBe(false);
  });
  it("honours custom buffers, multi-character labels and either section order without mutating state", async () => {
    const custom = structuredClone(scheme);
    custom.edgeBuffer = "U:UF";
    custom.cornerBuffer = "U:UFR";
    Object.values(custom.stickers).forEach((sticker, i) => {
      sticker.label = `X${i}`;
    });
    const state = await scrambleToState("F R U2 B' L2 D R2");
    const snapshot = structuredClone(state);
    const edge = paths(state, custom, "edge").at(-1)!,
      corner = paths(state, custom, "corner").at(-1)!;
    const result = compareTraceGroups(
      state,
      custom,
      [groups[1], groups[0]],
      [edge.join("|"), corner.join("|")],
      vocabulary(custom),
    );
    expect(result.every((g) => g.correct)).toBe(true);
    expect(result[0].actual).toEqual(edge);
    expect(result[1].actual).toEqual(corner);
    expect(state).toEqual(snapshot);
  });
  it("has no answers for a solved section and does not alter exact Memo Recall comparison", async () => {
    const state = await scrambleToState("");
    expect(
      compareTraceGroups(
        state,
        scheme,
        groups,
        ["", ""],
        vocabulary(scheme),
      ).every((g) => g.correct),
    ).toBe(true);
    expect(
      compareTraceGroups(
        state,
        scheme,
        [groups[0]],
        ["A"],
        vocabulary(scheme),
      )[0].correct,
    ).toBe(false);
    expect(
      compareGroups(
        [{ piece: "edges", tokens: ["A", "B"] }],
        ["BA"],
        vocabulary(scheme),
      )[0].correct,
    ).toBe(false);
  });
});
