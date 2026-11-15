import { cleanup, fireEvent, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useDetailsKeys } from "./useDetailsKeys";
afterEach(cleanup);
it("composing or repeated result keys cannot edit saved results or close details", () => {
  const close = vi.fn(),
    penalty = vi.fn();
  renderHook(() => useDetailsKeys(close, penalty));
  fireEvent.keyDown(window, { key: "2", isComposing: true });
  fireEvent.keyDown(window, { key: "2", repeat: true });
  fireEvent.keyDown(window, { key: "Escape", isComposing: true });
  expect(penalty).not.toHaveBeenCalled();
  expect(close).not.toHaveBeenCalled();
});

it("Enter closes details from the neutral surface without changing the saved result", () => {
  const close = vi.fn(),
    penalty = vi.fn();
  renderHook(() => useDetailsKeys(close, penalty));
  fireEvent.keyDown(window, { key: "Enter", shiftKey: true });
  expect(close).not.toHaveBeenCalled();
  fireEvent.keyDown(window, { key: "Enter" });
  expect(close).toHaveBeenCalledTimes(1);
  expect(penalty).not.toHaveBeenCalled();
});
