import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  cached: vi.fn(),
  prepare: vi.fn(),
  generate: vi.fn(),
}));
vi.mock("../utils/randomStateScramble", () => ({
  cachedScramble: mocks.cached,
  prepareScrambles: mocks.prepare,
  randomStateScramble: mocks.generate,
}));
import { useExecScramble } from "./useExecScramble";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.cached.mockReturnValue(null);
});
afterEach(cleanup);
it("reports preparation failure for the current request", async () => {
  mocks.generate.mockRejectedValue(new Error("worker unavailable"));
  const error = vi.fn();
  const hook = renderHook(() => useExecScramble("both", 1, true, error));
  await waitFor(() => expect(error).toHaveBeenCalledWith("both:1"));
  expect(hook.result.current).toBeNull();
});
it("ignores late completions and errors from a superseded request", async () => {
  const jobs = new Map<
    number,
    { resolve: (value: string) => void; reject: (error: Error) => void }
  >();
  mocks.generate.mockImplementation(
    (_filter, seed) =>
      new Promise<string>((resolve, reject) =>
        jobs.set(seed, { resolve, reject }),
      ),
  );
  const error = vi.fn();
  const hook = renderHook(
    ({ seed }) => useExecScramble("both", seed, true, error),
    { initialProps: { seed: 1 } },
  );
  hook.rerender({ seed: 2 });
  await act(async () => jobs.get(2)!.resolve("U R"));
  expect(hook.result.current).toBe("U R");
  await act(async () => jobs.get(1)!.reject(new Error("old failure")));
  expect(hook.result.current).toBe("U R");
  expect(error).not.toHaveBeenCalled();
  hook.rerender({ seed: 3 });
  expect(hook.result.current).toBeNull();
});
it("freezes a prepared scramble until its request identity changes", () => {
  mocks.cached.mockReturnValue("R U");
  const hook = renderHook(() => useExecScramble("both", 1, true));
  mocks.cached.mockReturnValue("F D");
  hook.rerender();
  expect(hook.result.current).toBe("R U");
});
