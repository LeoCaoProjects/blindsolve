import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useRef, useState, type ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { useDialogSpaceClose } from "./useDialogSpaceClose";

function Popup({
  name,
  onClose,
  children,
}: {
  name: string;
  onClose: () => void;
  children?: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  useDialogSpaceClose(root, onClose);
  return (
    <div ref={root} role="dialog" aria-label={name} tabIndex={-1}>
      {children}
    </div>
  );
}
afterEach(() => {
  fireEvent.blur(window);
  cleanup();
});
const space = (target: Element | Window, repeat = false) =>
  fireEvent.keyDown(target, { key: " ", code: "Space", repeat });
it("does not dismiss a popup with composing or modified Space", () => {
  const close = vi.fn();
  render(<Popup name="result" onClose={close} />);
  fireEvent.keyDown(window, { code: "Space", isComposing: true });
  fireEvent.keyDown(window, { code: "Space", shiftKey: true });
  expect(close).not.toHaveBeenCalled();
});
it("only dismisses the top popup, through the existing close callback", () => {
  const underneath = vi.fn(),
    top = vi.fn();
  render(
    <>
      <Popup name="underneath" onClose={underneath} />
      <Popup name="top" onClose={top} />
    </>,
  );
  space(window);
  expect(top).toHaveBeenCalledTimes(1);
  expect(underneath).not.toHaveBeenCalled();
});
it("leaves text entry and native Space controls alone", () => {
  const close = vi.fn();
  render(
    <Popup name="editing" onClose={close}>
      <input aria-label="word" />
      <textarea />
      <select />
      <div contentEditable />
      <button>Delete</button>
      <span role="checkbox" tabIndex={0} />
    </Popup>,
  );
  // jsdom does not implement isContentEditable; native browser coverage is in e2e.
  for (const element of screen.getByRole("dialog").children) {
    if (element.hasAttribute("contenteditable"))
      Object.defineProperty(element, "isContentEditable", { value: true });
    space(element);
  }
  expect(close).not.toHaveBeenCalled();
});
it("ignores opening-key repeats and owns the closing press through release after unmount", () => {
  const behind = vi.fn();
  function Harness() {
    const [open, setOpen] = useState(true);
    return open ? <Popup name="result" onClose={() => setOpen(false)} /> : null;
  }
  render(<Harness />);
  window.addEventListener("keydown", behind);
  try {
    space(window, true);
    expect(screen.getByRole("dialog")).toBeTruthy();
    space(window);
    expect(screen.queryByRole("dialog")).toBeNull();
    space(window, true);
    fireEvent.keyUp(window, { key: " ", code: "Space" });
    expect(behind).not.toHaveBeenCalled();
    space(window);
    expect(behind).toHaveBeenCalledTimes(1);
  } finally {
    window.removeEventListener("keydown", behind);
  }
});
