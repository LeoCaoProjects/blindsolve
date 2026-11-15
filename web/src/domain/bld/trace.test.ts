import { describe, expect, it } from "vitest";
import { scrambleToState } from "./cubing";
import { createSpeffzScheme } from "./speffz";
import {
  traceMemo,
  traceWithCanonicalBreaks,
  validateCubeState,
} from "./trace";

describe("BLD target tracing", () => {
  it("recognises solved and legal state", async () => {
    const state = await scrambleToState("");
    expect(validateCubeState(state).legal).toBe(true);
    const trace = traceMemo(state, createSpeffzScheme());
    expect(trace.edges.targets).toEqual([]);
    expect(trace.corners.targets).toEqual([]);
  });
  it("traces a legal random-looking scramble to completion with explicit breaks", async () => {
    const state = await scrambleToState("R U R' F2 D L2 B U2 F'");
    expect(validateCubeState(state).legal).toBe(true);
    const { trace, choices } = traceWithCanonicalBreaks(
      state,
      createSpeffzScheme(),
    );
    expect(trace.edges.status).toBe("complete");
    expect(trace.corners.status).toBe("complete");
    expect(
      trace.edges.targets.length + trace.corners.targets.length,
    ).toBeGreaterThan(5);
    expect(
      choices.edges.length + choices.corners.length,
    ).toBeGreaterThanOrEqual(0);
  });
  it("preserves multi-character custom labels as tokens", async () => {
    const scheme = createSpeffzScheme();
    scheme.stickers["U:UF"].label = "CH";
    const state = await scrambleToState("R U F");
    const { trace } = traceWithCanonicalBreaks(state, scheme);
    expect(
      [...trace.edges.targets, ...trace.corners.targets].every(
        (t) => typeof t.token === "string",
      ),
    ).toBe(true);
  });
  it("rejects a single flipped edge as illegal", async () => {
    const state = await scrambleToState("");
    state.EDGES.orientation[0] = 1;
    expect(validateCubeState(state).legal).toBe(false);
  });
  it("rejects a single twisted corner as illegal", async () => {
    const state = await scrambleToState("");
    state.CORNERS.orientation[0] = 1;
    expect(validateCubeState(state).legal).toBe(false);
  });
});
