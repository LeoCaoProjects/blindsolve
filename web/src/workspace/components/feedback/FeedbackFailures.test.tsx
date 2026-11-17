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
const app = vi.hoisted(() => ({
  submitFeedback: vi.fn(),
  updateFeedback: vi.fn(),
  deleteFeedback: vi.fn(),
  retryFeedback: vi.fn(),
  feedback: [],
  account: { role: "admin" },
  feedbackStatus: "ready",
}));
const store = vi.hoisted(() => ({ user: null as { id: string } | null, ready: true }));
vi.mock("../../../app/Store", () => ({ useStore: () => store }));
vi.mock("../../contexts/AppDataContext", () => ({ useAppData: () => app }));
import { FeedbackDetail } from "./FeedbackDetail";
import { FeedbackInbox } from "../../pages/FeedbackInbox";
import { FeedbackSheet } from "./FeedbackSheet";
const item = {
  id: "fixture",
  category: "bug" as const,
  message: "Test",
  status: "new" as const,
  source: "/",
  createdAt: "2026-01-01T00:00:00Z",
};
beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  vi.resetAllMocks();
  app.feedbackStatus = "ready";
  app.account.role = "admin";
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("submission failure keeps the draft and allows retry", async () => {
  app.submitFeedback
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValue({});
  render(<FeedbackSheet open onClose={vi.fn()} />);
  const field = screen.getByPlaceholderText(
    "What happened, and what did you expect?",
  );
  fireEvent.change(field, { target: { value: "Preserve my report" } });
  fireEvent.click(screen.getByRole("button", { name: "Send feedback" }));
  await screen.findByRole("button", { name: "Try again" });
  expect((field as HTMLTextAreaElement).value).toBe("Preserve my report");
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  await waitFor(() => expect(app.submitFeedback).toHaveBeenCalledTimes(2));
});
it("closing and reopening feedback ignores an abandoned submission response", async () => {
  let finish!: (value: unknown) => void;
  app.submitFeedback.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const close = vi.fn();
  const view = render(<FeedbackSheet open onClose={close} />);
  fireEvent.change(
    screen.getByPlaceholderText("What happened, and what did you expect?"),
    { target: { value: "Draft" } },
  );
  fireEvent.click(screen.getByRole("button", { name: "Send feedback" }));
  view.rerender(<FeedbackSheet open={false} onClose={close} />);
  view.rerender(<FeedbackSheet open onClose={close} />);
  await act(async () => finish({}));
  expect(screen.getByRole("button", { name: "Send feedback" })).toBeTruthy();
  expect(close).not.toHaveBeenCalled();
});
it("failed archive stays open, reports failure and retries without duplicate requests", async () => {
  app.updateFeedback
    .mockRejectedValueOnce(new Error("403"))
    .mockResolvedValue(undefined);
  const close = vi.fn();
  render(<FeedbackDetail item={item} onClose={close} />);
  fireEvent.click(screen.getByRole("button", { name: "Archive" }));
  fireEvent.click(screen.getByRole("button", { name: "Archive" }));
  await screen.findByRole("alert");
  expect(close).not.toHaveBeenCalled();
  expect(app.updateFeedback).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole("button", { name: "Archive" }));
  await waitFor(() => expect(close).toHaveBeenCalledOnce());
});
it("failed delete stays open and reports failure", async () => {
  app.deleteFeedback.mockRejectedValue(new Error("offline"));
  const close = vi.fn();
  render(<FeedbackDetail item={item} onClose={close} />);
  fireEvent.click(screen.getByRole("button", { name: "Delete permanently" }));
  fireEvent.click(screen.getByRole("button", { name: "Delete" }));
  await screen.findByRole("alert");
  expect(close).not.toHaveBeenCalled();
});
it.each(["loading", "error", "ready", "forbidden"])(
  "renders %s inbox state distinctly",
  (state) => {
    app.feedbackStatus = state === "forbidden" ? "ready" : state;
    if (state === "forbidden") app.account.role = "user";
    render(
      <MemoryRouter initialEntries={["/admin/feedback"]}>
        <Routes>
          <Route path="/admin/feedback" element={<FeedbackInbox />} />
          <Route path="/settings" element={<p>Settings destination</p>} />
        </Routes>
      </MemoryRouter>,
    );
    if (state === "loading")
      expect(screen.getByRole("status").textContent).toContain("Loading");
    if (state === "error") {
      expect(screen.getByRole("alert").textContent).toContain(
        "could not be loaded",
      );
      fireEvent.click(screen.getByText("Retry feedback"));
      expect(app.retryFeedback).toHaveBeenCalledOnce();
    }
    if (state === "ready")
      expect(screen.getByText("No feedback yet.")).toBeTruthy();
    if (state === "forbidden")
      expect(screen.getByText("Settings destination")).toBeTruthy();
  },
);
