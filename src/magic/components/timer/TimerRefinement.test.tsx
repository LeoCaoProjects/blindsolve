import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TimerMemoFooter } from "./TimerMemoFooter";
import { TimerModeControl } from "./TimerModeControl";
import { TimerPhaseCue } from "./TimerPhaseCue";
import type { Solve } from "../../types/solve";

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
    expect(screen.queryByText("Last memo")).toBeNull();
    expect(screen.getByText("Apple")).toBeTruthy();
    expect(screen.queryByText("DNF")).toBeNull();
    expect(screen.queryByText("8:28.66")).toBeNull();
    view.rerender(
      <TimerMemoFooter latest={null} mode="corners" memoOrder="edges-first" />,
    );
    expect(
      screen.getByRole("region", { name: "Last solve memo" }),
    ).toBeTruthy();
    expect(screen.getByLabelText("No previous memo").textContent).toBe(
      "\u2014",
    );
  });
  it("shows only the selected piece type", () => {
    render(
      <TimerMemoFooter latest={solve} mode="edges" memoOrder="corners-first" />,
    );
    expect(screen.getByText("Apple")).toBeTruthy();
    expect(screen.queryByText("Cloud")).toBeNull();
  });
  it("uses the shared utility trigger with a compact keyboard-accessible menu", () => {
    const changed = vi.fn(),
      key = vi.fn();
    const view = render(
      <div onKeyDown={key}>
        <TimerModeControl value="3bld" disabled={false} onChange={changed} />
      </div>,
    );
    const trigger = screen.getByRole("button", { name: "Timer mode" });
    fireEvent.keyDown(trigger, { key: " " });
    expect(key).not.toHaveBeenCalled();
    fireEvent.click(trigger);
    const choices = screen.getAllByRole("menuitemradio");
    expect(choices.map((option) => option.textContent)).toEqual([
      "3BLD",
      "Edges",
      "Corners",
    ]);
    expect(choices[0].getAttribute("aria-checked")).toBe("true");
    fireEvent.keyDown(choices[0], { key: "ArrowDown" });
    expect(document.activeElement).toBe(choices[1]);
    fireEvent.click(choices[1]);
    expect(changed).toHaveBeenCalledWith("edges");
    expect(document.activeElement).toBe(trigger);
    view.rerender(
      <TimerModeControl value="edges" disabled onChange={changed} />,
    );
    expect(
      (screen.getByRole("button", { name: "Timer mode" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });
  it("changes the phase label immediately without displaying split metrics", () => {
    const view = render(<TimerPhaseCue phase="memo" />);
    expect(screen.getByText("Memorising")).toBeTruthy();
    view.rerender(<TimerPhaseCue phase="exec" />);
    expect(screen.getByText("Executing")).toBeTruthy();
    expect(screen.queryByText("Memorising")).toBeNull();
  });
});
