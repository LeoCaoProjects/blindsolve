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

it("selects cycle breaks, commits once, and restores earlier choices with Back", async () => {
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
  expect(result.current.canBack).toBe(true);
  act(() => result.current.back());
  expect(result.current.step).toEqual(step);
  expect(result.current.optionFocus).toBe(step.options.length - 1);
  expect(result.current.breaks[step.piece]).toBeUndefined();
  expect(result.current.canBack).toBe(false);
  // Replacing the choice must discard the old continuation, even on repeated events.
  act(() => {
    result.current.pickBreak(step.options[0]);
    result.current.pickBreak(step.options[0]);
  });
  act(() => result.current.back());
  expect(result.current.step).toEqual(step);
  expect(result.current.canBack).toBe(false);

  // Undo across pieces and the transition into word entry, not just one break.
  const confirmed = [];
  for (let i = 0; i < 20 && result.current.step.kind === "break"; i++) {
    const current = result.current.step;
    confirmed.push(current);
    act(() => result.current.pickBreak(current.options.at(-1)!));
  }
  expect(result.current.step.kind).toBe("word");
  expect(confirmed.length).toBeGreaterThan(1);
  for (const previous of confirmed.reverse()) {
    act(() => result.current.back());
    expect(result.current.step).toEqual(previous);
    expect(result.current.optionFocus).toBe(previous.options.length - 1);
  }
  expect(result.current.canBack).toBe(false);
});

for (const existingDefaults of [false, true])
  it(`excludes obsolete words after correcting a completed reconstruction (${existingDefaults ? "overrides" : "new words"})`, async () => {
    const onSave = vi.fn();
    const state = await scrambleToState("R U F");
    const labels = "ABCDEFGHIJKLMNOPQRSTUVWX".split("");
    const db = existingDefaults
      ? Object.fromEntries(
          labels.flatMap((a) => labels.map((b) => [a + b, ["Apple"]])),
        )
      : {};
    const { result } = renderHook(() =>
      useReconstruction({
        draft: {
          time: 3000,
          memoTime: 1000,
          scramble: "R U F",
          date: new Date().toISOString(),
          timerMode: "3bld",
          sample: { corners: [], edges: [] },
          engine: { state, scheme: createSpeffzScheme() },
        },
        db,
        onSave,
      }),
    );
    for (let i = 0; i < 50 && result.current.step.kind !== "review"; i++) {
      act(() => {
        const step = result.current.step;
        if (step.kind === "break") result.current.pickBreak(step.options[0]);
        else result.current.next();
      });
    }
    expect(result.current.step.kind).toBe("review");
    const original = (["edges", "corners"] as const).flatMap((piece) =>
      result.current.sample[piece]
        .filter((pair) => pair.length === 2)
        .map((pair) => ({ piece, pair, word: `Entered-${piece}-${pair}` })),
    );
    act(() => {
      for (const { pair, piece, word } of original)
        result.current.setWord(pair, piece, word);
    });
    // Return through every word step and confirmed break to correct the first choice.
    for (let i = 0; i < 50 && result.current.canBack; i++)
      act(() => result.current.back());
    expect(result.current.step.kind).toBe("break");
    const first = result.current.step;
    if (first.kind !== "break") return;
    expect(first.options.length).toBeGreaterThan(1);
    act(() => result.current.pickBreak(first.options.at(-1)!));
    for (let i = 0; i < 20 && result.current.step.kind === "break"; i++) {
      act(() => {
        const step = result.current.step;
        if (step.kind === "break") result.current.pickBreak(step.options[0]);
      });
    }
    const current = (["edges", "corners"] as const).flatMap((piece) =>
      result.current.sample[piece].map((pair) => ({ pair, piece })),
    );
    const removed = original.filter(
      (old) =>
        !current.some(
          (ref) => ref.piece === old.piece && ref.pair === old.pair,
        ),
    );
    const obsolete = removed.filter(
      (old) => !current.some((ref) => ref.pair === old.pair),
    );
    expect(obsolete.length).toBeGreaterThan(0);
    const retained = original.filter((old) =>
      current.some((ref) => ref.piece === old.piece && ref.pair === old.pair),
    );
    expect(retained.length).toBeGreaterThan(0);
    for (const { pair, piece, word } of retained)
      expect(result.current.wordFor(pair, piece)).toBe(word);
    const added = current.filter(
      (ref) =>
        ref.pair.length === 2 && !original.some((old) => old.pair === ref.pair),
    );
    expect(added.length).toBeGreaterThan(0);
    for (const { pair, piece } of added)
      expect(result.current.wordFor(pair, piece)).toBe(
        existingDefaults ? "Apple" : "",
      );
    for (let i = 0; i < 50 && result.current.step.kind === "word"; i++) {
      act(() => {
        const step = result.current.step;
        if (step.kind !== "word") return;
        if (!result.current.wordFor(step.pair, step.piece))
          result.current.setWord(
            step.pair,
            step.piece,
            `Corrected-${step.pair}`,
          );
        result.current.next();
      });
    }
    expect(result.current.step.kind).toBe("review");
    for (const old of removed) {
      expect(result.current.changedPairs).not.toContainEqual(
        expect.objectContaining({ pair: old.pair, piece: old.piece }),
      );
      expect(result.current.newPairs).not.toContainEqual(
        expect.objectContaining({ pair: old.pair, piece: old.piece }),
      );
      expect(
        result.current.reviewMemo[old.piece].some(
          (ref) => ref.pair === old.pair,
        ),
      ).toBe(false);
    }
    act(() => result.current.finish());
    expect(onSave).toHaveBeenCalledTimes(1);
    const saved = onSave.mock.calls[0][0];
    for (const old of removed)
      expect(
        saved.memo[old.piece].some(
          (ref: { pair: string }) => ref.pair === old.pair,
        ),
      ).toBe(false);
    for (const old of obsolete)
      expect(saved.defaultWords).not.toHaveProperty(
        `${old.pair[0]}|${old.pair[1]}`,
      );
    for (const { pair, piece, word } of retained)
      expect(saved.memo[piece]).toContainEqual({ pair, word });
    for (const piece of ["edges", "corners"] as const)
      expect(
        saved.memo[piece].map((ref: { pair: string }) => ref.pair),
      ).toEqual(result.current.sample[piece]);
  });
