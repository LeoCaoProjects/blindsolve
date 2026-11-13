import React, { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { StickerEditor } from "./StickerEditor";
import { REFERENCE_COLORS, speffzScheme } from "../../utils/scheme";
afterEach(cleanup);
function Harness() {
  const [scheme, setScheme] = useState(speffzScheme);
  const [selected, setSelected] = useState("U0");
  return (
    <StickerEditor
      scheme={scheme}
      savedScheme={speffzScheme()}
      selected={selected}
      colors={REFERENCE_COLORS}
      onSelect={setSelected}
      onChange={(id, token) => setScheme((s) => ({ ...s, [id]: token }))}
    />
  );
}
describe("lettering field completion", () => {
  it("keeps the field uncluttered and normalizes case/whitespace before validating", () => {
    render(<Harness />);
    const input = screen.getByRole("textbox", {
      name: "Letter",
    }) as HTMLInputElement;
    expect(screen.queryByText(/label must be unique/)).toBeNull();
    expect(input.getAttribute("aria-invalid")).toBe("false");
    fireEvent.change(input, { target: { value: " b " } });
    expect(input.value).toBe("B");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    fireEvent.change(input, { target: { value: "sh" } });
    expect(input.value).toBe("SH");
    expect(input.getAttribute("aria-invalid")).toBe("false");
    expect(input.style.borderColor).toBe("");
  });
  it("restores the last usable letter when a cleared input loses focus", () => {
    render(<Harness />);
    const input = screen.getByRole("textbox", {
      name: "Letter",
    }) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "CH" } });
    fireEvent.change(input, { target: { value: "" } });
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.style.borderColor).toBe("var(--danger)");
    expect(screen.getByText(/Enter a letter/).className).toContain(
      "text-[var(--danger)]",
    );
    fireEvent.blur(input);
    expect(input.value).toBe("CH");
    expect(input.getAttribute("aria-invalid")).toBe("false");
  });
  it("restores duplicate edits on blur and sticker change to the last valid value", () => {
    render(<Harness />);
    let input = screen.getByRole("textbox") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "CH" } });
    fireEvent.change(input, { target: { value: "B" } });
    fireEvent.blur(input);
    expect(input.value).toBe("CH");
    expect(input.getAttribute("aria-invalid")).toBe("false");
    fireEvent.change(input, { target: { value: "B" } });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.click(screen.getByRole("button", { name: "Previous sticker" }));
    input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input.value).toBe("CH");
  });
  it("restores a blank letter when changing stickers and gives duplicate letters restrained error styling", () => {
    render(<Harness />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "" } });
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
    fireEvent.click(screen.getByRole("button", { name: "Previous sticker" }));
    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input.value).toBe("A");
    fireEvent.change(input, { target: { value: "B" } });
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.style.borderColor).toBe("var(--danger)");
    expect(screen.getByText(/Already used on/).className).toContain(
      "text-[var(--danger)]",
    );
  });
});
