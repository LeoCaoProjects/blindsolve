import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { PairEditor } from "./PairEditor";
afterEach(cleanup);
it.each(["delete", "edit", "mapping", "owner"])(
  "preserves draft and refuses stale save after %s",
  (kind) => {
    const save = vi.fn();
    const props = {
      first: "A",
      second: "B",
      entry: { shared: ["Apple"] },
      contextKey: "alice:scheme1",
      onSave: save,
      onClose: vi.fn(),
    };
    const view = render(<PairEditor {...props} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Default word" }), {
      target: { value: "Draft" },
    });
    view.rerender(
      <PairEditor
        {...props}
        entry={
          kind === "delete"
            ? undefined
            : kind === "edit"
              ? { shared: ["Newer"] }
              : props.entry
        }
        contextKey={
          kind === "mapping"
            ? "alice:scheme2"
            : kind === "owner"
              ? "bob:scheme1"
              : props.contextKey
        }
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(save).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain("Copy your draft");
    expect(
      (
        screen.getByRole("textbox", {
          name: "Default word",
        }) as HTMLInputElement
      ).value,
    ).toBe("Draft");
  },
);
