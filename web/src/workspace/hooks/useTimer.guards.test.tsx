import { act, cleanup, fireEvent, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useTimer } from "./useTimer";
import { useHoldStart } from "./useHoldStart";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it.each(["blur", "visibilitychange"])(
  "abandons a held Space on %s",
  (event) => {
    vi.useFakeTimers();
    const { result } = renderHook(() =>
      useTimer({ multiphase: false, disabled: false, onStop: vi.fn() }),
    );
    fireEvent.keyDown(window, { code: "Space" });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current.phase).toBe("ready");
    fireEvent(event === "blur" ? window : document, new Event(event));
    fireEvent.keyUp(window, { code: "Space" });
    expect(result.current.phase).toBe("idle");
  },
);

it.each([
  { isComposing: true },
  { ctrlKey: true },
  { altKey: true },
  { metaKey: true },
  { shiftKey: true },
])("ignores modified/composing Space %j", (flags) => {
  const { result } = renderHook(() =>
    useTimer({ multiphase: false, disabled: false, onStop: vi.fn() }),
  );
  fireEvent.keyDown(window, { code: "Space", ...flags });
  expect(result.current.phase).toBe("idle");
});

it("Training abandons held Space on visibility change", () => {
  vi.useFakeTimers();
  const start = vi.fn();
  renderHook(() => useHoldStart({ enabled: true, onStart: start }));
  fireEvent.keyDown(window, { code: "Space" });
  act(() => {
    vi.advanceTimersByTime(300);
  });
  fireEvent(document, new Event("visibilitychange"));
  fireEvent.keyUp(window, { code: "Space" });
  expect(start).not.toHaveBeenCalled();
});

it.each([{ isComposing: true }, { altKey: true }, { shiftKey: true }])(
  "Training ignores composing/modified Space %j",
  (flags) => {
    const { result } = renderHook(() =>
      useHoldStart({ enabled: true, onStart: vi.fn() }),
    );
    fireEvent.keyDown(window, { code: "Space", ...flags });
    expect(result.current.phase).toBe("idle");
  },
);
