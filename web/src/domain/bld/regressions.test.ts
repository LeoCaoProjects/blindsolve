import { describe, it, expect } from "vitest";
import { scrambleToState } from "./cubing";
import { createSpeffzScheme } from "./speffz";
import {
  traceSection,
  traceWithCanonicalBreaks,
  validateCubeState,
} from "./trace";
describe("independent BLD regressions", () => {
  it("maps a clockwise U face turn to the four known top-layer positions", async () => {
    const state = await scrambleToState("U");
    expect(state.EDGES.pieces).toEqual([1, 2, 3, 0, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(state.CORNERS.pieces).toEqual([1, 2, 3, 0, 4, 5, 6, 7]);
    expect(state.EDGES.orientation).toEqual(Array(12).fill(0));
    expect(state.CORNERS.orientation).toEqual(Array(8).fill(0));
  });
  it("maps the red face turn to a front turn when red is held at the front", async () => {
    expect(await scrambleToState("R", { up: "U", front: "R" })).toEqual(
      await scrambleToState("F"),
    );
  });
  // Published scramble and edge-trace fixture: https://jperm.net/bld
  it("matches J Perm's published edge example including a cycle break and flip", async () => {
    const scheme = createSpeffzScheme();
    scheme.edgeBuffer = "U:UR";
    const state = await scrambleToState(
      "B2 R2 B2 L U2 R' B2 R2 B2 R' U' B' F L' B D R B2 D B' D' U",
    );
    const trace = traceSection(state, scheme, "edge", ["B:BL", "U:UL"]);
    expect(trace.targets.map((t) => t.token).join("")).toBe("QUSRNXIVPRDE");
    expect(trace.status).toBe("complete");
  });
  it("records both sides of a flipped non-buffer edge", async () => {
    const state = await scrambleToState("");
    state.EDGES.orientation[0] = 1;
    state.EDGES.orientation[4] = 1;
    expect(
      traceSection(state, createSpeffzScheme(), "edge", ["U:UF"]).targets.map(
        (t) => t.token,
      ),
    ).toEqual(["C", "I"]);
  });
  it("records entry, next target, repeated entry for a disconnected swap", async () => {
    const state = await scrambleToState("");
    [state.EDGES.pieces[0], state.EDGES.pieces[1]] = [1, 0];
    expect(
      traceSection(state, createSpeffzScheme(), "edge", ["U:UF"]).targets.map(
        (t) => t.token,
      ),
    ).toEqual(["C", "B", "C"]);
  });
  it("represents a twisted corner with two differently oriented targets", async () => {
    const state = await scrambleToState("");
    state.CORNERS.orientation[0] = 1;
    state.CORNERS.orientation[2] = 2;
    expect(
      traceSection(state, createSpeffzScheme(), "corner", [
        "U:UFR",
      ]).targets.map((t) => t.stickerId),
    ).toEqual(["U:UFR", "F:UFR"]);
  });
  it("keeps parity and legality after wide turns", async () => {
    for (const alg of ["R", "Rw", "Rw2 Uw'", "R U F2 L D' B x y"]) {
      const state = await scrambleToState(alg);
      expect(validateCubeState(state).legal).toBe(true);
      const { trace } = traceWithCanonicalBreaks(state, createSpeffzScheme());
      expect(trace.edges.targets.length % 2).toBe(
        trace.corners.targets.length % 2,
      );
    }
    expect(await scrambleToState("x y")).toEqual(await scrambleToState(""));
  });
  it("validates permutations rather than just parity", async () => {
    const state = await scrambleToState("");
    state.EDGES.pieces[1] = 0;
    expect(validateCubeState(state).legal).toBe(false);
  });
});
