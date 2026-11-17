import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { TrainingActivity } from "./TrainingActivity";
afterEach(cleanup);
it("ranks selected-period counts, omits zero modes and updates to retained lifetime counts", () => {
  const { rerender } = render(
    <TrainingActivity
      range="30d"
      modes={[
        { mode: "guided", attempts: 2 },
        { mode: "exec", attempts: 0 },
        { mode: "recognition", attempts: 7 },
      ]}
    />,
  );
  expect(screen.getByText("Completed attempts · 30 days")).toBeTruthy();
  expect(screen.getAllByRole("listitem").map((n) => n.textContent)).toEqual([
    "Target Recognition7",
    "Guided Solve2",
  ]);
  expect(screen.queryByRole("progressbar")).toBeNull();
  rerender(
    <TrainingActivity
      range="all"
      modes={[
        { mode: "guided", attempts: 50 },
        { mode: "recognition", attempts: 8 },
      ]}
    />,
  );
  expect(screen.getByText("Completed attempts · All time")).toBeTruthy();
  expect(screen.getAllByRole("listitem").map((n) => n.textContent)).toEqual([
    "Guided Solve50",
    "Target Recognition8",
  ]);
});
it("labels each period and shows a clean zero state", () => {
  const { rerender } = render(<TrainingActivity range="24h" modes={[]} />);
  expect(screen.getByText("Completed attempts · 24 hours")).toBeTruthy();
  expect(screen.getByText("No Training attempts in this period.")).toBeTruthy();
  rerender(
    <TrainingActivity range="7d" modes={[{ mode: "exec", attempts: 0 }]} />,
  );
  expect(screen.getByText("Completed attempts · 7 days")).toBeTruthy();
  expect(screen.queryAllByRole("listitem")).toHaveLength(0);
});
