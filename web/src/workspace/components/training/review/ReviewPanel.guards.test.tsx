import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ReviewPanel } from "./ReviewPanel";
import { ConfirmDialog } from "../../common/ConfirmDialog";

afterEach(cleanup);

it("traps review focus in both directions and restores the trigger", async () => {
  const trigger = document.createElement("button");
  document.body.append(trigger);
  trigger.focus();
  const view = render(
    <ReviewPanel label="Review" header="Result" onNext={vi.fn()}>
      <button>First action</button>
    </ReviewPanel>,
  );
  const first = screen.getByRole("button", { name: "First action" });
  const last = screen.getByRole("button", { name: /^Next/ });
  try {
    const root = screen.getByRole("dialog", { name: "Review" });
    await waitFor(() => expect(document.activeElement).toBe(root));
    fireEvent.keyDown(root, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
    fireEvent.keyDown(last, { key: "Tab" });
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(first, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
    fireEvent.keyDown(last, { key: "Tab" });
    expect(document.activeElement).toBe(first);
    view.unmount();
    expect(document.activeElement).toBe(trigger);
  } finally {
    trigger.remove();
  }
});

it("reserves pending review Enter for a neutral press and leaves nested alerts in control", async () => {
  const onSave = vi.fn();
  const onCancel = vi.fn();
  const onNext = vi.fn();
  const alertCancel = vi.fn();
  const alertConfirm = vi.fn();
  const renderReview = (alert = false) => (
    <ReviewPanel
      label="Review"
      header="Result"
      onNext={onNext}
      pending={{ count: 1, onSave, onCancel }}
    >
      <input aria-label="Word" />
      <ConfirmDialog
        open={alert}
        title="Decision"
        onCancel={alertCancel}
        confirm={{ label: "Confirm decision", onClick: alertConfirm }}
      />
    </ReviewPanel>
  );
  const view = render(renderReview());
  const root = screen.getByRole("dialog", { name: "Review" });
  await waitFor(() => expect(document.activeElement).toBe(root));
  for (const guard of [
    { repeat: true },
    { isComposing: true },
    { ctrlKey: true },
    { altKey: true },
    { metaKey: true },
    { shiftKey: true },
  ])
    fireEvent.keyDown(root, { key: "Enter", ...guard });
  const input = screen.getByRole("textbox", { name: "Word" });
  input.focus();
  fireEvent.keyDown(input, { key: "Enter" });
  expect(onSave).not.toHaveBeenCalled();
  root.focus();
  fireEvent.keyDown(root, { key: "Enter" });
  expect(onSave).toHaveBeenCalledTimes(1);
  expect(onNext).not.toHaveBeenCalled();
  view.rerender(renderReview(true));
  const alert = screen.getByRole("alertdialog", { name: "Decision" });
  await waitFor(() => expect(alert.contains(document.activeElement)).toBe(true));
  fireEvent.keyDown(alert, { key: "Enter" });
  fireEvent.keyDown(alert, { key: "Escape" });
  expect(alertCancel).toHaveBeenCalledTimes(1);
  expect(alertConfirm).not.toHaveBeenCalled();
  expect(onSave).toHaveBeenCalledTimes(1);
  expect(onCancel).not.toHaveBeenCalled();
});

it("composing and repeated Enter cannot submit review", () => {
  const next = vi.fn();
  render(
    <ReviewPanel label="Review" header="Result" onNext={next}>
      Answer
    </ReviewPanel>,
  );
  fireEvent.keyDown(window, { key: "Enter", isComposing: true });
  fireEvent.keyDown(window, { key: "Enter", repeat: true });
  expect(next).not.toHaveBeenCalled();
});
