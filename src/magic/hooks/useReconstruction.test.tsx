import { cubeHighlightFor } from "../utils/reconstruction";
import { stateFromScramble } from "../utils/cube";
import { act, renderHook, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { scrambleToState } from "../../domain/bld/cubing";
import { createSpeffzScheme } from "../../domain/bld/speffz";
import { useReconstruction } from "./useReconstruction";
afterEach(cleanup);
describe("Timer piece-scoped reconstruction", () => {
  for (const mode of ["edges", "corners"] as const)
    it(`reconstructs ${mode} while learning Default words`, async () => {
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
      expect(Object.keys(saved.defaultWords).length).toBeGreaterThan(0);
      expect(
        Object.keys(saved.defaultWords).every(
          (key) => key.includes("|") && !key.includes(":"),
        ),
      ).toBe(true);
    });
});

it("keeps piece-specific solve words while ordinary edits save only Default", async () => {
  const onSave = vi.fn();
  const state = await scrambleToState("R U F");
  const labels = "ABCDEFGHIJKLMNOPQRSTUVWX".split("");
  const db = Object.fromEntries(
    labels.flatMap((a) =>
      labels
        .filter((b) => b !== a)
        .flatMap((b) => [
          [a + b, ["Apple"]],
          [`edges:${a + b}`, ["Arrow"]],
          [`corners:${a + b}`, ["Castle"]],
        ]),
    ),
  );
  const { result } = renderHook(() =>
    useReconstruction({
      draft: {
        time: 3000,
        memoTime: 1000,
        scramble: "R U F",
        date: new Date().toISOString(),
        timerMode: "3bld",
        sample: { edges: [], corners: [] },
        engine: { state, scheme: createSpeffzScheme() },
      },
      db,
      onSave,
    }),
  );
  for (let i = 0; i < 50 && result.current.step.kind !== "review"; i++)
    act(() => {
      const step = result.current.step;
      if (step.kind === "break") result.current.pickBreak(step.options[0]);
      else result.current.next();
    });
  const pair = result.current.sample.edges.find((pair) => pair.length === 2)!;
  expect(result.current.wordFor(pair, "edges")).toBe("Arrow");
  expect(result.current.wordFor(pair, "corners")).toBe("Castle");
  act(() => {
    result.current.setWord(pair, "edges", "Plum");
    result.current.decide(pair, "edges", "replace");
  });
  expect(result.current.wordFor(pair, "corners")).toBe("Castle");
  act(() => result.current.finish());
  const saved = onSave.mock.calls[0][0];
  expect(saved.defaultWords).toEqual({ [`${pair[0]}|${pair[1]}`]: "Plum" });
  expect(
    saved.memo.corners
      .filter((p: { pair: string }) => p.pair.length === 2)
      .every((p: { word: string }) => p.word === "Castle"),
  ).toBe(true);
  expect(
    saved.memo.edges.find((p: { pair: string }) => p.pair === pair).word,
  ).toBe("Plum");
});

it("selects a cycle-break option without committing until Continue", async () => {
  const scheme = createSpeffzScheme();
  scheme.edgeMethod = "m2";
  scheme.edgeBuffer = "D:DF";
  const scramble = "R U F";
  const state = await scrambleToState(scramble);
  const { result } = renderHook(() =>
    useReconstruction({
      draft: {
        time: 3000,
        memoTime: 1000,
        date: new Date().toISOString(),
        scramble,
        sample: { corners: [], edges: [] },
        engine: { state, scheme },
        memoPrefs: { memoOrder: "edges-first", m2SecondTargetSwap: true },
      },
      db: {},
      onSave: vi.fn(),
    }),
  );
  const step = result.current.step;
  expect(step.kind).toBe("break");
  if (step.kind !== "break") return;
  const targets = cubeHighlightFor(
    result.current,
    stateFromScramble(scramble),
  )!.targets;
  expect(targets.map((t) => t.value)).toEqual(step.options);
  const choice = step.options.at(-1)!;
  act(() => result.current.focusBreak(choice));
  expect(result.current.step.kind).toBe("break");
  expect(result.current.optionFocus).toBe(step.options.length - 1);
  expect(result.current.breaks[step.piece]).toBeUndefined();
  act(() => result.current.primary());
  expect(result.current.breaks[step.piece]).toBe(choice);
});
