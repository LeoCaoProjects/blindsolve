import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { TimerMemoFooter } from "./TimerMemoFooter";
import { TimerModeControl } from "./TimerModeControl";
import { TimerPhaseCue } from "./TimerPhaseCue";
import type { Solve } from "../../types/solve";
import type { TimerMode } from "../../utils/timerModes";
afterEach(cleanup);
const solve: Solve = {
  id: "fixture",
  index: 3,
  time: 508660,
  memoTime: 410640,
  penalty: "dnf",
  date: "2026-11-05T00:00:00.000Z",
  scramble: "R U",
  memo: {
    edges: [{ pair: "AB", word: "Apple" }],
    corners: [{ pair: "CD", word: "Cloud" }],
  },
};
describe("Timer refinement", () => {
  it("keeps the memo footer present without solves and never shows timing results", () => {
    const view = render(
      <TimerMemoFooter latest={solve} mode="3bld" memoOrder="edges-first" />,
    );
    expect(screen.getByRole("heading", { name: "Last memo" })).toBeTruthy();
    expect(screen.getByText("Apple")).toBeTruthy();
    expect(screen.queryByText("DNF")).toBeNull();
    expect(screen.queryByText("8:28.66")).toBeNull();
    view.rerender(
      <TimerMemoFooter latest={null} mode="corners" memoOrder="edges-first" />,
    );
    expect(
      screen.getByRole("region", { name: "Last solve memo" }),
    ).toBeTruthy();
    expect(screen.getByLabelText("No previous memo")).toBeTruthy();
  });
  it("shows only the selected piece type", () => {
    render(
      <TimerMemoFooter latest={solve} mode="edges" memoOrder="corners-first" />,
    );
    expect(screen.getByText("Apple")).toBeTruthy();
    expect(screen.queryByText("Cloud")).toBeNull();
  });
  it("isolates mode clicks, preserves the global Space shortcut and supports arrows", () => {
    const pointer = vi.fn(),
      key = vi.fn(),
      changed = vi.fn();
    function Harness() {
      const [mode, setMode] = useState<TimerMode>("3bld");
      return (
        <div onPointerDown={pointer} onKeyDown={key}>
          <TimerModeControl
            value={mode}
            disabled={false}
            onChange={(next) => {
              changed(next);
              setMode(next);
            }}
          />
        </div>
      );
    }
    render(<Harness />);
    const first = screen.getByRole("radio", { name: "3BLD" });
    fireEvent.pointerDown(first);
    fireEvent.keyDown(first, { key: " " });
    expect(pointer).not.toHaveBeenCalled();
    expect(key).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(first, { key: "ArrowRight" });
    expect(changed).toHaveBeenCalledWith("edges");
    expect(key).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("radio", { name: "Edges" }).getAttribute("aria-checked"),
    ).toBe("true");
  });
  it("changes the phase label immediately without displaying split metrics", () => {
    const view = render(<TimerPhaseCue phase="memo" />);
    expect(screen.getByText("Memorising")).toBeTruthy();
    view.rerender(<TimerPhaseCue phase="exec" />);
    expect(screen.getByText("Executing")).toBeTruthy();
    expect(screen.queryByText("Memorising")).toBeNull();
  });
});
