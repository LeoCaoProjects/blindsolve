import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TimerReadout } from "./TimerReadout";

describe("TimerReadout live-time preference", () => {
  afterEach(cleanup);

  it("shows elapsed time by default and when explicitly enabled", () => {
    const { rerender } = render(<TimerReadout phase="running" value={1234} />);
    expect(screen.getByRole("timer").textContent).toBe("1.23");
    rerender(
      <TimerReadout phase="memo" value={2345} showLiveTimer={true} />,
    );
    expect(screen.getByRole("timer").textContent).toBe("2.34");
  });

  it("shows Solve without exposing elapsed time throughout active phases", () => {
    const { rerender } = render(
      <TimerReadout phase="memo" value={1234} showLiveTimer={false} />,
    );
    expect(screen.getByRole("timer").textContent).toBe("Solve");
    expect(screen.queryByText("1.23")).toBeNull();
    rerender(
      <TimerReadout phase="exec" value={5678} showLiveTimer={false} />,
    );
    expect(screen.getByRole("timer").textContent).toBe("Solve");
    expect(screen.queryByText("5.68")).toBeNull();
  });

  it("reveals the exact final result and penalties after stopping", () => {
    const { rerender } = render(
      <TimerReadout phase="stopped" value={5678} showLiveTimer={false} />,
    );
    expect(screen.getByRole("timer").textContent).toBe("5.67");
    rerender(
      <TimerReadout
        phase="stopped"
        value={5678}
        penalty="+2"
        showLiveTimer={false}
      />,
    );
    expect(screen.getByRole("timer").textContent).toContain("7.67");
    rerender(
      <TimerReadout
        phase="stopped"
        value={5678}
        penalty="dnf"
        showLiveTimer={false}
      />,
    );
    expect(screen.getByRole("timer").textContent).toBe("DNF");
  });
});
