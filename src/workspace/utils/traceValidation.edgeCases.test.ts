import { describe, it, expect, afterAll } from "vitest";
import { scrambleToState } from "../../domain/bld/cubing";
import { createSpeffzScheme } from "../../domain/bld/speffz";
import {
  occupantHomeSticker,
  traceSection,
  validateCubeState,
} from "../../domain/bld/trace";
import type {
  CubeOrbitState,
  LetteringScheme,
  PieceType,
} from "../../domain/bld/types";
import { compareTraceGroups } from "./traceValidation";
let checks = 0,
  breakNeighbourChecks = 0;
// Independent submitted-target interpreter: consume each target, enforce forced
// moves/break legality, and check the resulting orbit instead of comparing a path.
function accepts(
  state: CubeOrbitState,
  scheme: LetteringScheme,
  type: PieceType,
  tokens: string[],
) {
  const work = structuredClone(state),
    orbit = type === "edge" ? work.EDGES : work.CORNERS;
  const buffer =
    scheme.stickers[type === "edge" ? scheme.edgeBuffer : scheme.cornerBuffer];
  const modulus = type === "edge" ? 2 : 3;
  for (const token of tokens) {
    const unsolved = orbit.pieces
      .map((p, i) =>
        i !== buffer.pieceIndex && (p !== i || orbit.orientation[i] !== 0)
          ? i
          : -1,
      )
      .filter((i) => i >= 0);
    if (!unsolved.length) return false;
    const target = Object.values(scheme.stickers).find(
      (s) => s.pieceType === type && s.label === token,
    );
    if (!target) return false;
    const forced = occupantHomeSticker(work, scheme, buffer.id);
    if (forced.pieceIndex === buffer.pieceIndex) {
      if (!unsolved.includes(target.pieceIndex)) return false;
    } else if (target.id !== forced.id) return false;
    const b = buffer.pieceIndex,
      t = target.pieceIndex,
      bo = orbit.orientation[b],
      to = orbit.orientation[t];
    [orbit.pieces[b], orbit.pieces[t]] = [orbit.pieces[t], orbit.pieces[b]];
    orbit.orientation[t] =
      (((bo + target.orientationIndex - buffer.orientationIndex) % modulus) +
        modulus) %
      modulus;
    orbit.orientation[b] =
      (((to + buffer.orientationIndex - target.orientationIndex) % modulus) +
        modulus) %
      modulus;
  }
  return orbit.pieces.every((p, i) => p === i && orbit.orientation[i] === 0);
}
function complete(
  state: CubeOrbitState,
  scheme: LetteringScheme,
  type: PieceType,
  selection: number,
) {
  const choices: string[] = [];
  for (let guard = 0; guard < 50; guard++) {
    const section = traceSection(state, scheme, type, choices);
    if (section.status === "complete") return section;
    choices.push(
      section.validCycleBreaks[selection % section.validCycleBreaks.length],
    );
  }
  throw new Error("fixture did not complete");
}
const scrambles = [
  "",
  "R",
  "R U R' F2 D L2 B U2 F'",
  "F2 B2 R2 L2 U2 D2",
  "R U2 F' L D2 B R2 U'",
];
for (const custom of [false, true])
  for (const type of ["edge", "corner"] as const)
    describe(`Trace exhaustive local mutations ${custom ? "custom buffers" : "default buffers"} ${type}`, () => {
      for (const scramble of scrambles)
        it(`matches independent replay for ${scramble || "solved"}`, async () => {
          const scheme = createSpeffzScheme();
          if (custom) {
            scheme.edgeBuffer = "U:UF";
            scheme.cornerBuffer = "U:UFR";
          }
          const state = await scrambleToState(scramble);
          expect(validateCubeState(state).legal).toBe(true);
          const vocabulary = [
            ...new Set(Object.values(scheme.stickers).map((s) => s.label)),
          ];
          const group = {
            piece: type === "edge" ? ("edges" as const) : ("corners" as const),
            tokens: [],
          };
          const check = (tokens: string[]) => {
            checks++;
            const result = compareTraceGroups(
              state,
              scheme,
              [group],
              [tokens.join("")],
              vocabulary,
            )[0];
            expect(result.correct, `tokens ${tokens.join("")}`).toBe(
              accepts(state, scheme, type, tokens),
            );
          };
          for (const selection of [0, 1, 23]) {
            const section = complete(state, scheme, type, selection),
              valid = section.targets.map((t) => t.token);
            check(valid);
            for (let i = 0; i <= valid.length; i++) {
              if (i < valid.length) {
                const deleted = [...valid];
                deleted.splice(i, 1);
                check(deleted);
              }
              const inserted = [...valid];
              inserted.splice(i, 0, "A");
              check(inserted);
              if (i < valid.length) {
                for (const replacement of vocabulary) {
                  if (replacement === valid[i]) continue;
                  const changed = [...valid];
                  changed[i] = replacement;
                  check(changed);
                }
              }
            }
            // Wrong previous/next pairs around every break, not just the first break.
            section.targets.forEach((target, index) => {
              if (!target.cycleBreak) return;
              for (const offset of [-2, -1, 0, 1, 2]) {
                const i = index + offset;
                if (i < 0 || i >= valid.length) continue;
                const changed = [...valid];
                changed[i] = "Z";
                breakNeighbourChecks++;
                check(changed);
              }
              // Choosing any sticker on an already solved/visited piece is also tested
              // by the all-label substitutions at this exact break position above.
            });
          }
        }, 20000);
    });

for (const type of ["edge", "corner"] as const)
  it(`rejects initially solved, previously completed-cycle and buffer breaks in ${type}`, async () => {
    const scheme = createSpeffzScheme(),
      state = await scrambleToState("");
    const orbit = type === "edge" ? state.EDGES : state.CORNERS;
    const buffer =
      scheme.stickers[
        type === "edge" ? scheme.edgeBuffer : scheme.cornerBuffer
      ];
    const ids = orbit.pieces.filter((i) => i !== buffer.pieceIndex);
    for (const cycle of [ids.slice(0, 3), ids.slice(3, 6)]) {
      orbit.pieces[cycle[0]] = cycle[1];
      orbit.pieces[cycle[1]] = cycle[2];
      orbit.pieces[cycle[2]] = cycle[0];
    }
    expect(validateCubeState(state).legal).toBe(true);
    const first = traceSection(state, scheme, type);
    const choice = first.validCycleBreaks[0];
    const next = traceSection(state, scheme, type, [choice]);
    expect(next.status).toBe("cycle-break");
    expect(next.validCycleBreaks).not.toContain(choice);
    const section = complete(state, scheme, type, 0),
      tokens = section.targets.map((t) => t.token),
      at = next.targets.length;
    const invalid = Object.values(scheme.stickers).filter(
      (s) => s.pieceType === type && !next.validCycleBreaks.includes(s.id),
    );
    expect(
      invalid.some((s) => s.pieceIndex === scheme.stickers[choice].pieceIndex),
    ).toBe(true);
    expect(invalid.some((s) => s.pieceIndex === ids[6])).toBe(true);
    for (const sticker of invalid) {
      const typed = [...tokens];
      typed[at] = sticker.label;
      checks++;
      expect(accepts(state, scheme, type, typed)).toBe(false);
      expect(
        compareTraceGroups(
          state,
          scheme,
          [{ piece: type === "edge" ? "edges" : "corners", tokens: [] }],
          [typed.join("")],
          Object.values(scheme.stickers).map((s) => s.label),
        )[0].correct,
      ).toBe(false);
    }
  });
afterAll(() => {
  expect(checks).toBeGreaterThan(10000);
  expect(breakNeighbourChecks).toBeGreaterThan(400);
});
