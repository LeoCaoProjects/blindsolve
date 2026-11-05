import { act, renderHook, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { scrambleToState } from "../../domain/bld/cubing";
import { createSpeffzScheme } from "../../domain/bld/speffz";
import { useReconstruction } from "./useReconstruction";
afterEach(cleanup);
describe("Timer piece-scoped reconstruction", () => {
  for (const mode of ["edges", "corners"] as const)
    it(`reconstructs and learns only ${mode}`, async () => {
      const onSave = vi.fn();
      const state = await scrambleToState("R U F");
      const { result } = renderHook(() =>
        useReconstruction({
          draft: {
            time: 3000,
            memoTime: 1000,
            scramble: "R U F",
            date: new Date().toISOString(),
            timerMode: mode,
            sample: { corners: [], edges: [] },
            engine: { state, scheme: createSpeffzScheme() },
          },
          db: {},
          onSave,
        }),
      );
      for (
        let step = 0;
        step < 50 && result.current.step.kind !== "review";
        step++
      ) {
        const current = result.current.step;
        expect(current.piece).toBe(mode);
        act(() => {
          if (current.kind === "break")
            result.current.pickBreak(current.options[0]);
          else if (current.kind === "word") {
            result.current.setWord(current.pair, current.piece, "Mnemonic");
            result.current.next();
          }
        });
      }
      expect(result.current.step.kind).toBe("review");
      act(() => result.current.finish());
      const saved = onSave.mock.calls[0][0];
      const other = mode === "edges" ? "corners" : "edges";
      expect(saved.memo[other]).toEqual([]);
      expect(saved.cycleBreaks[other]).toEqual([]);
      expect(saved.memo[mode].length).toBeGreaterThan(0);
      expect(Object.keys(saved.dbUpdates).length).toBeGreaterThan(0);
      expect(
        Object.keys(saved.dbUpdates).every((key) => key.startsWith(mode + ":")),
      ).toBe(true);
    });
});
