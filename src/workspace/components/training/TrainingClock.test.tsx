import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { CompactTrainingTimer } from "./CompactTrainingTimer";
vi.mock("../layout/SubNavigation", () => ({
  SubNavigation: () => null,
  SUB_NAV_EASE: [0.22, 1, 0.36, 1],
  SUB_NAV_ITEM: "",
}));
const setting = vi.hoisted(() => ({ showLiveTimer: false }));
vi.mock("../../contexts/AppDataContext", () => ({
  useAppData: () => ({ prefs: setting }),
}));
afterEach(cleanup);
it("the central compact Memo clock masks only running values", () => {
  setting.showLiveTimer = false;
  const { rerender } = render(
    <CompactTrainingTimer value={1234} phase="memo" />,
  );
  expect(screen.getByRole("timer").textContent).toBe("Solve");
  setting.showLiveTimer = true;
  rerender(<CompactTrainingTimer value={1234} phase="memo" />);
  expect(screen.getByRole("timer").textContent).toBe("1.23");
  setting.showLiveTimer = false;
  rerender(<CompactTrainingTimer value={1234} phase="stopped" />);
  expect(screen.getByRole("timer").textContent).toBe("1.23");
});

it("the shared Trace clock respects live timing and shows completed raw time", () => {
  setting.showLiveTimer = false;
  const { rerender } = render(
    <CompactTrainingTimer value={3456} phase="running" label="Trace" />,
  );
  expect(screen.getByRole("timer").textContent).toBe("Solve");
  setting.showLiveTimer = true;
  rerender(<CompactTrainingTimer value={3456} phase="running" label="Trace" />);
  expect(screen.getByRole("timer").textContent).toBe("3.45");
  setting.showLiveTimer = false;
  rerender(<CompactTrainingTimer value={3456} phase="stopped" label="Trace" />);
  expect(screen.getByRole("timer").textContent).toBe("3.45");
});
