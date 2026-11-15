import {
  act,
  cleanup,
  fireEvent,
  renderHook,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  mode: "3bld" as "3bld" | "edges" | "corners",
  generate: vi.fn(),
  restricted: vi.fn(),
  state: vi.fn(),
  update: vi.fn(),
  owner: "alice",
}));
vi.mock("../../domain/bld/cubing", () => ({
  generateBlindScramble: mocks.generate,
  scrambleToState: mocks.state,
}));
vi.mock("../utils/randomStateScramble", () => ({
  randomStateScramble: mocks.restricted,
}));
vi.mock("../../app/Store", () => ({
  useStore: () => ({
    ready: true,
    user: { id: mocks.owner },
    data: emptyData(),
    update: mocks.update,
  }),
}));
vi.mock("../contexts/AppDataContext", () => ({
  useAppData: () => ({
    solves: [],
    setSolves: vi.fn(),
    timerDb: {},
    setDefaultWords: vi.fn(),
    timerMode: mocks.mode,
    setTimerMode: vi.fn(),
    prefs: { m2SecondTargetSwap: false, memoOrder: "corners-first" },
  }),
}));
import { emptyData } from "../../data/model";
import { useTimerSession } from "./useTimerSession";
beforeEach(() => {
  mocks.mode = "3bld";
  mocks.generate.mockReset();
  mocks.restricted.mockReset();
  mocks.state.mockReset();
  mocks.update.mockReset();
  mocks.owner = "alice";
});
afterEach(cleanup);
describe("Timer mode scramble ownership", () => {
  it("does not commit a completed solve to an account selected while tracing is pending", async () => {
    mocks.generate.mockResolvedValue("R U");
    let finish!: (state: unknown) => void;
    mocks.state.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { result, rerender } = renderHook(() =>
      useTimerSession({ multiphase: true, stage: "live" }),
    );
    await waitFor(() => expect(result.current.scramblePending).toBe(false));
    act(() => result.current.timer.forceRunning(3000, 1000));
    act(() => fireEvent.keyDown(window, { code: "Space", key: " " }));
    expect(mocks.state).toHaveBeenCalled();
    act(() => {
      mocks.owner = "bob";
      rerender();
    });
    await act(async () => finish({
      EDGES: { pieces: Array.from({length:12},(_,i)=>i), orientation: Array(12).fill(0) },
      CORNERS: { pieces: Array.from({length:8},(_,i)=>i), orientation: Array(8).fill(0) },
    }));
    expect(mocks.update).not.toHaveBeenCalled();
    expect(result.current.draft).toBeNull();
  });
  it("ignores a late 3BLD scramble after selecting Edges", async () => {
    let full!: (scramble: string) => void, edges!: (scramble: string) => void;
    mocks.generate.mockReturnValue(
      new Promise((resolve) => {
        full = resolve;
      }),
    );
    mocks.restricted.mockReturnValue(
      new Promise((resolve) => {
        edges = resolve;
      }),
    );
    const { result, rerender } = renderHook(() =>
      useTimerSession({ multiphase: true, stage: "live" }),
    );
    act(() => {
      mocks.mode = "edges";
      rerender();
    });
    expect(result.current.scramble).toBe("");
    expect(result.current.scramblePending).toBe(true);
    await act(async () => edges("R2 U2"));
    expect(result.current.scramble).toBe("R2 U2");
    expect(mocks.restricted).toHaveBeenCalledWith("edges", expect.any(Number));
    await act(async () => full("F U B"));
    expect(result.current.scramble).toBe("R2 U2");
    expect(result.current.scramblePending).toBe(false);
  });
  it("allows retry after a restricted-state worker failure", async () => {
    mocks.mode = "corners";
    mocks.restricted
      .mockRejectedValueOnce(new Error("Worker unavailable"))
      .mockResolvedValueOnce("R2");
    const { result } = renderHook(() =>
      useTimerSession({ multiphase: true, stage: "live" }),
    );
    await waitFor(() => expect(result.current.scrambleError).toBe(true));
    expect(result.current.scramblePending).toBe(false);
    await act(async () => result.current.newScramble());
    expect(result.current.scramble).toBe("R2");
    expect(result.current.scrambleError).toBe(false);
    expect(mocks.generate).not.toHaveBeenCalled();
  });
});
