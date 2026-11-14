import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "./ConfirmDialog";

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Remove pair</button>
      <ConfirmDialog
        open={open}
        title="Remove this pair?"
        confirm={{ label: "Remove", onClick: vi.fn(), tone: "danger" }}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}

describe("ConfirmDialog focus", () => {
  afterEach(cleanup);

  it("focuses the safe action, traps Tab, and returns focus to its trigger", async () => {
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Remove pair" });
    trigger.focus();
    fireEvent.click(trigger);
    const cancel = screen.getByRole("button", { name: "Cancel" });
    const remove = screen.getByRole("button", { name: "Remove" });
    await waitFor(() => expect(document.activeElement).toBe(cancel));
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(remove);
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(cancel);
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it("runs a confirmation only once for a rapid double click", async () => {
    const confirm = vi.fn();
    render(
      <ConfirmDialog
        open
        title="Remove this pair?"
        confirm={{ label: "Remove", onClick: confirm, tone: "danger" }}
        onCancel={vi.fn()}
      />,
    );
    const remove = screen.getByRole("button", { name: "Remove" });
    fireEvent.click(remove);
    fireEvent.click(remove);
    expect(confirm).toHaveBeenCalledTimes(1);
  });
});
