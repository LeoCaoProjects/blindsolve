import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { speffzScheme } from "../../utils/scheme";
import { SchemeCube } from "./SchemeCube";
import type { CubeMode } from "../../types/app";

vi.hoisted(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
});
afterEach(cleanup);

it.each(["edge-buffer", "corner-buffer"] as const)(
  "aligns %s on tab entry only, preserving manual angles during buffer changes",
  (bufferMode) => {
    const first = bufferMode === "edge-buffer" ? "B1" : "B0";
    const clicked = bufferMode === "edge-buffer" ? "F1" : "F0";
    const quick = bufferMode === "edge-buffer" ? "D1" : "D0";
    function Harness() {
      const [mode, setMode] = useState<CubeMode>("view");
      const [buffer, setBuffer] = useState(first);
      return (
        <>
          <SchemeCube
            scheme={speffzScheme()}
            size={300}
            mode={mode}
            edgeBuffer={buffer}
            cornerBuffer={buffer}
            onPick={setBuffer}
            showBuffers
            freeRotation
          />
          <button onClick={() => setMode(bufferMode)}>Buffer tab</button>
          <button onClick={() => setMode("view")}>Overview</button>
          <button onClick={() => setBuffer(quick)}>Quick choice</button>
        </>
      );
    }
    render(<Harness />);
    const cube = screen.getByRole("group", { name: "Cube" });
    const transform = () =>
      (cube.firstElementChild as HTMLElement).style.transform;
    const initial = transform();
    fireEvent.click(screen.getByRole("button", { name: "Buffer tab" }));
    expect(transform()).not.toBe(initial);
    fireEvent.keyDown(cube, { key: "ArrowRight" });
    const manual = transform();
    fireEvent.click(cube.querySelector(`[data-sticker-id="${clicked}"]`)!);
    expect(transform()).toBe(manual);
    expect(
      cube
        .querySelector(`[data-sticker-id="${clicked}"]`)
        ?.getAttribute("data-buffer"),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Quick choice" }));
    expect(transform()).toBe(manual);
    fireEvent.click(screen.getByRole("button", { name: "Overview" }));
    expect(transform()).toBe(manual);
    fireEvent.click(screen.getByRole("button", { name: "Buffer tab" }));
    expect(transform()).not.toBe(manual);
  },
);

it("preserves manual orientation on sticker picks but still reveals programmatically selected stickers", () => {
  function Harness() {
    const [selected, setSelected] = useState<string | null>(null);
    return (
      <>
        <SchemeCube
          scheme={speffzScheme()}
          size={300}
          mode="lettering"
          selected={selected}
          onPick={setSelected}
          revealSelected
          freeRotation
        />
        <button onClick={() => setSelected("D6")}>Next sticker</button>
      </>
    );
  }
  render(<Harness />);
  const cube = screen.getByRole("group", { name: "Cube" });
  const transform = () =>
    (cube.firstElementChild as HTMLElement).style.transform;
  expect(cube.querySelector('[data-selected="true"]')).toBeNull();
  fireEvent.keyDown(cube, { key: "ArrowRight" });
  const manual = transform();
  fireEvent.click(cube.querySelector('[data-sticker-id="F0"]')!);
  expect(
    cube.querySelector('[data-sticker-id="F0"]')?.getAttribute("data-selected"),
  ).toBe("true");
  expect(transform()).toBe(manual);
  fireEvent.click(cube.querySelector('[data-sticker-id="F0"]')!);
  expect(transform()).toBe(manual);
  fireEvent.click(screen.getByRole("button", { name: "Next sticker" }));
  expect(transform()).not.toBe(manual);
});

describe("SchemeCube pair highlighting", () => {
  it("keeps only exact target stickers bright and dims centres and unrelated pieces", () => {
    const { container } = render(
      <SchemeCube
        scheme={speffzScheme()}
        size={300}
        mode="static"
        highlightIds={["U1", "F1"]}
      />,
    );
    const stickers = Array.from(
      container.querySelectorAll<HTMLElement>('[style*="opacity"]'),
    );
    expect(
      stickers.filter((sticker) => sticker.style.opacity === "1"),
    ).toHaveLength(2);
    expect(
      stickers.filter((sticker) => sticker.style.opacity === "0.2").length,
    ).toBeGreaterThan(40);
    expect(screen.getByRole("group", { name: "Cube" })).toBeTruthy();
  });
});

it("marks only the recognition source, keeping partner colours unmarked", () => {
  const { container } = render(
    <SchemeCube
      scheme={speffzScheme()}
      size={300}
      mode="static"
      hideLetters
      recognitionSource="U1"
      highlightIds={["U1", "B1"]}
    />,
  );
  const source = container.querySelector<HTMLElement>(
    '[data-sticker-id="U1"]',
  )!;
  const partner = container.querySelector<HTMLElement>(
    '[data-sticker-id="B1"]',
  )!;
  expect(source.querySelector("[data-recognition-aura]")).toBeTruthy();
  expect(container.querySelectorAll("[data-recognition-aura]")).toHaveLength(1);
  expect(source.style.boxShadow).toContain("#fff");
  expect(partner.style.boxShadow).toBe("");
  expect(partner.style.opacity).toBe("0.6");
  expect(source.style.opacity).toBe("1");
  expect(source.textContent).toBe("");
});

it("only exposes allowed reconstruction cells as selectable buttons", () => {
  const pick = vi.fn();
  render(
    <SchemeCube
      scheme={speffzScheme()}
      size={300}
      mode="lettering"
      selected="U1"
      pickableIds={["U1", "F1"]}
      onPick={pick}
      revealSelected
      freeRotation
      animateOrientation
    />,
  );
  expect(screen.getAllByRole("button")).toHaveLength(2);
  fireEvent.click(screen.getAllByRole("button")[1]);
  expect(pick).toHaveBeenCalledWith("F1");
});
