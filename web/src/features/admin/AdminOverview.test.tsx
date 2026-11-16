import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AdminOverview } from "./AdminOverview";
const state = vi.hoisted(() => ({
  owner: "alice",
  ready: true,
  role: "admin",
  status: "ready",
  load: vi.fn(),
}));
vi.mock("../../app/Store", () => ({
  useStore: () => ({
    user: state.owner ? { id: state.owner } : null,
    ready: state.ready,
  }),
}));
vi.mock("../../workspace/contexts/AppDataContext", () => ({
  useAppData: () => ({
    account: { role: state.role },
    feedbackStatus: state.status,
    retryFeedback: vi.fn(),
  }),
}));
vi.mock("./api", () => ({ loadOverview: state.load }));
vi.mock("../../workspace/components/common/ShortcutSheet", () => ({
  ShortcutSheet: () => null,
}));
const view = () => (
  <MemoryRouter initialEntries={["/admin"]}>
    <Routes>
      <Route path="/admin" element={<AdminOverview />} />
      <Route path="/settings" element={<p>Settings destination</p>} />
    </Routes>
  </MemoryRouter>
);
beforeEach(() => {
  state.owner = "alice";
  state.ready = true;
  state.role = "admin";
  state.status = "ready";
  state.load.mockReset();
});
afterEach(cleanup);
it("waits for auth initialization rather than redirecting a returning administrator", () => {
  state.owner = "";
  state.ready = false;
  render(view());
  expect(screen.getByRole("status").textContent).toContain("Checking Admin");
  expect(state.load).not.toHaveBeenCalled();
});
it("aborts old requests and never renders an old admin response after account switching", async () => {
  let finish!: (value: unknown) => void;
  state.load.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const rendered = render(view());
  await waitFor(() => expect(state.load).toHaveBeenCalledOnce());
  const signal = state.load.mock.calls[0][1] as AbortSignal;
  state.owner = "bob";
  state.role = "user";
  rendered.rerender(view());
  expect(screen.getByText("Settings destination")).toBeTruthy();
  expect(signal.aborted).toBe(true);
  await act(async () => finish({ registeredAccounts: 987654 }));
  expect(screen.queryByText("987,654")).toBeNull();
  expect(state.load).toHaveBeenCalledOnce();
});
it("makes no Overview request for denied accounts", () => {
  state.role = "user";
  render(view());
  expect(state.load).not.toHaveBeenCalled();
  expect(screen.getByText("Settings destination")).toBeTruthy();
});

it("keeps the shell, metrics and selected chart mounted while only the latest range response wins", async () => {
  const report = (solves: number) => ({
    updatedAt: "2026-11-17T10:00:00Z",
    since: "2026-11-10T10:00:00Z",
    registeredAccounts: 18,
    newAccounts: 2,
    activeUsers: 3,
    solves,
    training: 6,
    undatedSolves: 0,
    undatedTraining: 0,
    trend: [{ day: "2026-11-16", accounts: 2, solves, training: 6 }],
    modes: [{ mode: "exec", attempts: 6 }],
    feedback: { open: 1, new: 1 },
  });
  state.load.mockResolvedValueOnce(report(10));
  render(view());
  await screen.findByText("10", { selector: "dd" });
  const main = screen.getByRole("main", { name: "Overview" });
  fireEvent.click(screen.getByRole("radio", { name: "Training" }));
  const pending: ((value: unknown) => void)[] = [];
  state.load.mockImplementation(
    () => new Promise((resolve) => pending.push(resolve)),
  );
  for (const label of ["24 hours", "7 days", "30 days", "All time"]) {
    fireEvent.click(screen.getByRole("radio", { name: label }));
    expect(screen.getByRole("main", { name: "Overview" })).toBe(main);
    expect(screen.getByText("10", { selector: "dd" })).toBeTruthy();
    expect(screen.queryByText("Loading overview…")).toBeNull();
  }
  await act(async () => pending[3](report(40)));
  expect(screen.getByText("40", { selector: "dd" })).toBeTruthy();
  for (const finish of pending.slice(0, 3))
    await act(async () => finish(report(999)));
  expect(screen.queryByText("999", { selector: "dd" })).toBeNull();
  expect(
    screen
      .getByRole("radio", { name: "Training" })
      .getAttribute("aria-checked"),
  ).toBe("true");
  expect(screen.getByText("Completed attempts · All time")).toBeTruthy();
});
