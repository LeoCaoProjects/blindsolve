import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { emptyData, parseData, type AppData } from "../../data/model";
import { setupFromStore } from "../contexts/AppDataContext";
import { useTrainingSession } from "./useTrainingSession";

const state = vi.hoisted(() => ({
  data: {} as AppData,
  update: vi.fn(),
  scramble: "R U2 F' L2 D B2 R' U F2 D' L B'" as string | null,
}));
vi.mock("../../app/Store", () => ({ useStore: () => state }));
vi.mock("./useExecScramble", () => ({ useExecScramble: () => state.scramble }));
vi.mock("../utils/randomStateScramble", () => ({ FIRST_EXEC_SEED: 1 }));
vi.mock("../contexts/AppDataContext", async (original) => {
  const actual = await original<typeof import("../contexts/AppDataContext")>();
  return {
    ...actual,
    useAppData: () => ({
      setup: actual.setupFromStore(state.data),
      pairs: {},
      prefs: { memoOrder: state.data.memoOrder, m2SecondTargetSwap: true },
    }),
  };
});
beforeEach(() => {
  vi.useFakeTimers();
  state.data = emptyData();
  state.scramble = "R U2 F' L2 D B2 R' U F2 D' L B'";
  state.update.mockImplementation((fn) => {
    state.data = fn(state.data);
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
function start(result: { current: ReturnType<typeof useTrainingSession> }) {
  act(() =>
    result.current.hold.pointerHandlers.onPointerDown({
      button: 0,
      pointerType: "touch",
      pointerId: 1,
      target: document.body,
    } as never),
  );
  act(() => vi.advanceTimersByTime(300));
  act(() => {
    result.current.hold.pointerHandlers.onPointerUp({ pointerType: "touch", pointerId: 1 } as never);
  });
}
it("finishes once with summary-only persistence and in-memory atomic review", () => {
  const { result, rerender } = renderHook(() =>
    useTrainingSession({ mode: "recognition" }),
  );
  start(result);
  const steps = result.current.recognitionSteps;
  expect(steps.length).toBeGreaterThan(1);
  steps.forEach((step, i) =>
    act(() => result.current.answerRecognition(i === 0 ? "ZZ" : step.expected)),
  );
  expect(result.current.phase).toBe("review");
  act(() => result.current.answerRecognition("X"));
  expect(state.data.attempts).toHaveLength(1);
  const attempt = state.data.attempts[0];
  expect(attempt.targets).toBe(steps.length);
  expect(attempt.accuracy).toBe((steps.length - 1) / steps.length);
  expect(Object.keys(attempt).sort()).toEqual(
    [
      "id",
      "kind",
      "trainingMode",
      "createdAt",
      "durationMs",
      "targets",
      "correct",
      "accuracy",
    ].sort(),
  );
  expect(result.current.results[0].typed[0]).toBe("ZZ");
  expect(result.current.results[0].actual[0]).toBe(steps[0].expected);
  expect(result.current.allCorrect).toBe(false);
  rerender();
  act(() => result.current.removeAttempt(attempt.id));
  expect(state.data.attempts).toHaveLength(0);
});
it("cancels abandoned input across route/mode activation and relevant settings changes", () => {
  const { result, rerender } = renderHook(
    ({ active }) => useTrainingSession({ mode: "recognition" }, active),
    { initialProps: { active: true } },
  );
  start(result);
  act(() => result.current.answerRecognition("SH"));
  rerender({ active: false });
  expect(result.current.phase).toBe("idle");
  expect(result.current.recognitionAnswers).toEqual([]);
  rerender({ active: true });
  start(result);
  state.data = { ...state.data, memoOrder: "edges-first" };
  rerender({ active: true });
  expect(result.current.phase).toBe("idle");
  expect(state.data.attempts).toHaveLength(0);
  expect(setupFromStore(state.data).edgeBuffer).toBeTruthy();
});
it("cannot start while preparing or after an empty reconstruction", () => {
  state.scramble = null;
  const { result, rerender } = renderHook(() =>
    useTrainingSession({ mode: "recognition" }),
  );
  expect(result.current.scrambleReady).toBe(false);
  start(result);
  expect(result.current.phase).toBe("idle");
  state.scramble = "R R'";
  rerender();
  expect(result.current.scrambleReady).toBe(false);
  expect(result.current.scrambleError).toBe(true);
});

it("drops obsolete review payloads while preserving historical summary stats", () => {
  state.data.attempts = [
    {
      id: crypto.randomUUID(),
      kind: "memo",
      trainingMode: "recognition",
      createdAt: new Date().toISOString(),
      correct: false,
      accuracy: 0.5,
      targets: 2,
      durationMs: 1000,
    },
  ];
  const parsed = parseData({
    ...state.data,
    attempts: state.data.attempts.map((a) => ({
      ...a,
      recognitionAnswers: "old review data",
    })),
  });
  expect("recognitionAnswers" in parsed.attempts[0]).toBe(false);
  expect(parsed.attempts[0].targets).toBe(2);
  expect(parsed.attempts[0].accuracy).toBe(0.5);
});

it("settings changes cancel a pending held start", () => {
  const { result, rerender } = renderHook(() =>
    useTrainingSession({ mode: "recognition" }),
  );
  act(() =>
    result.current.hold.pointerHandlers.onPointerDown({
      button: 0,
      pointerType: "touch",
      pointerId: 1,
      target: document.body,
    } as never),
  );
  act(() => vi.advanceTimersByTime(300));
  state.data = { ...state.data, memoOrder: "edges-first" };
  rerender();
  act(() => {
    result.current.hold.pointerHandlers.onPointerUp({ pointerType: "touch", pointerId: 1 } as never);
  });
  expect(result.current.phase).toBe("idle");
});

it("Backspace rewinds one atomic answer and the observation without changing the running timer", () => {
  const { result } = renderHook(() =>
    useTrainingSession({ mode: "recognition" }),
  );
  start(result);
  const source = result.current.recognitionSteps[0].source;
  act(() => result.current.undoRecognition());
  expect(result.current.recognitionAnswers).toEqual([]);
  act(() => result.current.answerRecognition("SH"));
  act(() => vi.advanceTimersByTime(500));
  const elapsed = result.current.elapsed.total;
  act(() => result.current.undoRecognition());
  expect(result.current.phase).toBe("active");
  expect(result.current.recognitionAnswers).toEqual([]);
  expect(
    result.current.recognitionSteps[result.current.recognitionAnswers.length]
      .source,
  ).toBe(source);
  expect(result.current.elapsed.total).toBe(elapsed);
  expect(state.data.attempts).toHaveLength(0);
  for (const step of result.current.recognitionSteps)
    act(() => result.current.answerRecognition(step.expected));
  expect(state.data.attempts).toHaveLength(1);
  expect(state.data.attempts[0].correct).toBe(true);
  expect(state.data.attempts[0].accuracy).toBe(1);
});
