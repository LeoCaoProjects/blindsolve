import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ReviewPanel } from "./ReviewPanel";

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
    await waitFor(() => expect(document.activeElement).toBe(first));
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
