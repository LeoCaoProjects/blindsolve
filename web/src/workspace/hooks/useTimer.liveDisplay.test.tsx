import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TimerReadout } from "../components/solve/TimerReadout";
import { type TimerResult, useTimer } from "./useTimer";

function Harness({
  showLiveTimer,
  multiphase,
  onStop,
}: {
  showLiveTimer: boolean;
  multiphase: boolean;
  onStop: (result: TimerResult) => void;
}) {
  const timer = useTimer({ multiphase, disabled: false, onStop });
  return (
    <>
      <TimerReadout
        phase={timer.phase}
        value={timer.display}
        showLiveTimer={showLiveTimer}
      />
      <button onClick={() => timer.forceRunning(1000, multiphase ? 400 : undefined)}>
        Start test timer
      </button>
      <button
        onClick={() => timer.pointerHandlers.onPointerDown({ button: 0 } as never)}
      >
        Stop test timer
      </button>
    </>
  );
}

describe("live display remains presentation-only", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it.each([true, false])(
    "records the same precise elapsed time with showLiveTimer=%s",
    (showLiveTimer) => {
      const stopped = vi.fn();
      const now = vi.spyOn(performance, "now").mockReturnValue(10_000);
      render(
        <Harness
          showLiveTimer={showLiveTimer}
          multiphase={false}
          onStop={stopped}
        />,
      );
      fireEvent.click(screen.getByText("Start test timer"));
      expect(screen.getByRole("timer").textContent).toBe(
        showLiveTimer ? "0.00" : "Solve",
      );
      now.mockReturnValue(12_500);
      fireEvent.click(screen.getByText("Stop test timer"));
      expect(stopped).toHaveBeenCalledWith({ total: 3500, memo: undefined });
      expect(screen.getByRole("timer").textContent).toBe("3.50");
    },
  );

  it("preserves the exact memo split while the multiphase display is hidden", () => {
    const stopped = vi.fn();
    const now = vi.spyOn(performance, "now").mockReturnValue(20_000);
    render(
      <Harness showLiveTimer={false} multiphase={true} onStop={stopped} />,
    );
    fireEvent.click(screen.getByText("Start test timer"));
    expect(screen.getByRole("timer").textContent).toBe("Solve");
    now.mockReturnValue(22_750);
    fireEvent.click(screen.getByText("Stop test timer"));
    expect(stopped).toHaveBeenCalledWith({ total: 3750, memo: 400 });
    expect(screen.getByRole("timer").textContent).toBe("3.75");
  });
});
