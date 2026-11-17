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

const pointer = (pointerType: string, pointerId = 1) =>
  ({ pointerType, pointerId, button: 0, target: document.body }) as never;
it("mouse/trackpad cannot arm, release a keyboard hold, or stop; touch/pen still can", () => {
  vi.useFakeTimers();
  const stop = vi.fn();
  const { result } = renderHook(() =>
    useTimer({ multiphase: false, disabled: false, onStop: stop }),
  );
  act(() => {
    result.current.pointerHandlers.onPointerDown(pointer("mouse"));
    vi.advanceTimersByTime(300);
    result.current.pointerHandlers.onPointerUp(pointer("mouse"));
  });
  expect(result.current.phase).toBe("idle");
  fireEvent.keyDown(window, { code: "Space" });
  act(() => vi.advanceTimersByTime(300));
  act(() => result.current.pointerHandlers.onPointerUp(pointer("mouse")));
  expect(result.current.phase).toBe("ready");
  fireEvent.keyUp(window, { code: "Space" });
  expect(result.current.phase).toBe("running");
  act(() => {
    result.current.pointerHandlers.onPointerDown(pointer("mouse"));
    result.current.pointerHandlers.onPointerUp(pointer("mouse"));
  });
  expect(result.current.phase).toBe("running");
  expect(stop).not.toHaveBeenCalled();
  act(() => {
    result.current.pointerHandlers.onPointerDown(pointer("touch"));
    result.current.pointerHandlers.onPointerUp(pointer("touch"));
  });
  expect(stop).toHaveBeenCalledOnce();
  act(() => result.current.pointerHandlers.onPointerDown(pointer("pen")));
  act(() => vi.advanceTimersByTime(300));
  act(() => result.current.pointerHandlers.onPointerUp(pointer("pen")));
  expect(result.current.phase).toBe("running");
});
it("Training starts only with direct touch/pen and cancellation cannot leave it ready", () => {
  vi.useFakeTimers();
  const start = vi.fn();
  const { result } = renderHook(() =>
    useHoldStart({ enabled: true, onStart: start }),
  );
  act(() => {
    result.current.pointerHandlers.onPointerDown(pointer("mouse"));
    vi.advanceTimersByTime(300);
    result.current.pointerHandlers.onPointerUp(pointer("mouse"));
  });
  expect(result.current.phase).toBe("idle");
  expect(start).not.toHaveBeenCalled();
  act(() => result.current.pointerHandlers.onPointerDown(pointer("touch")));
  act(() => vi.advanceTimersByTime(100));
  act(() => result.current.pointerHandlers.onPointerCancel(pointer("touch")));
  act(() => vi.advanceTimersByTime(300));
  expect(result.current.phase).toBe("idle");
  expect(start).not.toHaveBeenCalled();
  act(() => result.current.pointerHandlers.onPointerDown(pointer("touch")));
  act(() => vi.advanceTimersByTime(280));
  act(() => result.current.pointerHandlers.onPointerUp(pointer("mouse")));
  expect(result.current.phase).toBe("ready");
  act(() => result.current.pointerHandlers.onPointerUp(pointer("touch")));
  expect(start).toHaveBeenCalledOnce();
});
it("mouse cannot advance either phase of a multiphase solve", () => {
  vi.useFakeTimers();
  const stop = vi.fn();
  const { result } = renderHook(() =>
    useTimer({ multiphase: true, disabled: false, onStop: stop }),
  );
  fireEvent.keyDown(window, { code: "Space" });
  act(() => vi.advanceTimersByTime(280));
  fireEvent.keyUp(window, { code: "Space" });
  expect(result.current.phase).toBe("memo");
  act(() => {
    result.current.pointerHandlers.onPointerDown(pointer("mouse"));
    result.current.pointerHandlers.onPointerUp(pointer("mouse"));
  });
  expect(result.current.phase).toBe("memo");
  fireEvent.keyDown(window, { code: "Space" });
  fireEvent.keyUp(window, { code: "Space" });
  expect(result.current.phase).toBe("exec");
  act(() => {
    result.current.pointerHandlers.onPointerDown(pointer("mouse"));
    result.current.pointerHandlers.onPointerUp(pointer("mouse"));
  });
  expect(stop).not.toHaveBeenCalled();
  act(() => {
    result.current.pointerHandlers.onPointerDown(pointer("touch"));
    result.current.pointerHandlers.onPointerUp(pointer("touch"));
  });
  expect(stop).toHaveBeenCalledOnce();
});
