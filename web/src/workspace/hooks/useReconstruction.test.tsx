import { cubeHighlightFor } from "../utils/reconstruction";
import { stateFromScramble } from "../utils/cube";
import { act, renderHook, cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { scrambleToState } from "../../domain/bld/cubing";
import { createSpeffzScheme } from "../../domain/bld/speffz";
import { traceMemo } from "../../domain/bld/trace";
import { m2SecondTargetStickerId } from "../../domain/bld/memoConventions";
import { inferM2OrientationFromBuffer } from "../../domain/bld/orientation";
import { useReconstruction } from "./useReconstruction";
import { REVIEW_SAVE_PAUSE_MS, useReviewSaveGuard } from "./useReviewSaveGuard";
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
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
  const raw = traceMemo(state, scheme).edges;
  expect(step.piece).toBe("edges");
  expect(result.current.breakTargetIds).toEqual(raw.validCycleBreaks);
  const faces = "ULFRBD";
  const slots = [1, 5, 7, 3];
  const expectedTargets = raw.validCycleBreaks.map((id) => {
    const label = scheme.stickers[id].label.charCodeAt(0) - 65;
    const presented = m2SecondTargetStickerId(
      id,
      raw.targets.length,
      inferM2OrientationFromBuffer(scheme.edgeBuffer)!,
    );
    return {
      id: faces[Math.floor(label / 4)] + slots[label % 4],
      value: scheme.stickers[presented].label,
    };
  });
  expect(targets).toEqual(expectedTargets);
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

it("keeps the swapped M2 option on its raw cell and reopens a separate later edge break", async () => {
  const scheme = createSpeffzScheme();
  scheme.edgeMethod = "m2";
  scheme.edgeBuffer = "D:DF";
  const onSave = vi.fn();
  const mount = async (scramble: string) => {
    const state = await scrambleToState(scramble);
    return renderHook(() => useReconstruction({
      draft: {
        time: 3000, memoTime: 1000, date: new Date().toISOString(), scramble,
        sample: { corners: [], edges: [] },
        timerMode: "edges",
        engine: { state, scheme },
        memoPrefs: { memoOrder: "edges-first", m2SecondTargetSwap: true },
      },
      db: {},
      onSave,
    }));
  };
  const swapped = await mount("R D F");
  expect(cubeHighlightFor(swapped.result.current, stateFromScramble("R D F"))!.targets)
    .toEqual(expect.arrayContaining([{ id: "U7", value: "W" }, { id: "D7", value: "C" }]));
  act(() => fireEvent.keyDown(window, { key: "w" }));
  act(() => swapped.result.current.finish());
  expect(onSave.mock.calls[0][0].cycleBreaks.edges).toEqual(["U:UF"]);
  swapped.unmount();

  // R and L disturb disjoint edge cycles and leave DF in place.
  const later = await mount("R L");
  const initial = later.result.current.step;
  expect(initial).toMatchObject({ kind: "break", piece: "edges" });
  act(() => later.result.current.pickBreak("B")); // U:UR starts the R orbit.
  expect(later.result.current.step).toMatchObject({ kind: "break", piece: "edges" });
  expect(later.result.current.breakTargetIds).toContain("U:UL");
  expect(later.result.current.breakTargetIds).not.toContain("U:UR");
  const independentBreak = later.result.current.step;
  act(() => fireEvent.keyDown(window, { key: "Enter", repeat: true }));
  expect(later.result.current.step).toEqual(independentBreak);
  if (independentBreak.kind !== "break") throw new Error("Expected a later break");
  act(() => fireEvent.keyDown(window, { key: independentBreak.options[0], repeat: true }));
  expect(later.result.current.step).toEqual(independentBreak);
  act(() => later.result.current.back());
  expect(later.result.current.step).toEqual(initial);
  expect(later.result.current.breaks.edges).toBeUndefined();
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

for (const input of ["click", "Enter", "held Enter"] as const)
  it(`keeps the completed review open through repeated ${input} until input settles`, async () => {
    const state = await scrambleToState("R U F");
    const labels = "ABCDEFGHIJKLMNOPQRSTUVWX".split("");
    const db = Object.fromEntries(
      labels.flatMap((a) => labels.map((b) => [a + b, ["Apple"]])),
    );
    const onSave = vi.fn();
    vi.useFakeTimers();
    const { result } = renderHook(() =>
      useReconstruction({
        draft: {
          time: 3000,
          memoTime: 1000,
          scramble: "R U F",
          date: new Date().toISOString(),
          sample: { corners: [], edges: [] },
          engine: { state, scheme: createSpeffzScheme() },
        },
        db,
        onSave,
      }),
    );
    for (let i = 0; i < 30 && result.current.step.kind !== "review"; i++)
      act(() => result.current.primary());
    expect(result.current.step.kind).toBe("review");
    expect(result.current.canSave).toBe(false);
    for (let i = 0; i < 12; i++) {
      act(() => vi.advanceTimersByTime(100));
      act(() => {
        if (input === "click") result.current.primary();
        else
          fireEvent.keyDown(window, {
            key: "Enter",
            repeat: input === "held Enter",
          });
      });
      expect(onSave).not.toHaveBeenCalled();
      expect(result.current.canSave).toBe(false);
    }
    act(() => vi.advanceTimersByTime(REVIEW_SAVE_PAUSE_MS - 1));
    expect(result.current.canSave).toBe(false);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.canSave).toBe(true);
    if (input === "Enter") {
      for (const flags of [
        { shiftKey: true },
        { altKey: true },
        { ctrlKey: true },
        { metaKey: true },
        { isComposing: true },
      ]) {
        act(() => fireEvent.keyDown(window, { key: "Enter", ...flags }));
        expect(onSave).not.toHaveBeenCalled();
        expect(result.current.canSave).toBe(true);
      }
    }
    if (input === "click") {
      act(() => result.current.back());
      expect(result.current.step.kind).toBe("break");
      act(() => result.current.primary());
      expect(result.current.step.kind).toBe("review");
      expect(result.current.canSave).toBe(false);
      act(() => result.current.primary());
      expect(onSave).not.toHaveBeenCalled();
      act(() => vi.advanceTimersByTime(REVIEW_SAVE_PAUSE_MS));
    }
    if (input === "held Enter") {
      act(() => fireEvent.keyDown(window, { key: "Enter", repeat: true }));
      expect(onSave).not.toHaveBeenCalled();
      act(() => fireEvent.keyUp(window, { key: "Enter" }));
      act(() => vi.advanceTimersByTime(REVIEW_SAVE_PAUSE_MS));
    }
    act(() => {
      if (input === "click") {
        result.current.primary();
        result.current.primary();
      } else fireEvent.keyDown(window, { key: "Enter" });
    });
    expect(onSave).toHaveBeenCalledTimes(1);
  });

it("cleans up a pending quiet interval on unmount and remounts unready", () => {
  vi.useFakeTimers();
  const first = renderHook(() => useReviewSaveGuard(true));
  expect(first.result.current.ready).toBe(false);
  expect(vi.getTimerCount()).toBe(1);
  first.unmount();
  expect(vi.getTimerCount()).toBe(0);
  act(() => vi.advanceTimersByTime(REVIEW_SAVE_PAUSE_MS));
  const second = renderHook(() => useReviewSaveGuard(true));
  expect(second.result.current.ready).toBe(false);
  act(() => vi.advanceTimersByTime(REVIEW_SAVE_PAUSE_MS));
  expect(second.result.current.ready).toBe(true);
});
