import { describe, it, expect } from "vitest";
import { randomIndex, typingTarget } from "./interaction";
describe("practice interactions", () => {
  it("assigns equal random intervals to every card, with no history input", () => {
    const counts = [0, 0, 0, 0];
    for (let i = 0; i < 1000; i++) counts[randomIndex(4, () => i / 1000)]++;
    expect(counts).toEqual([250, 250, 250, 250]);
    expect(() => randomIndex(0)).toThrow();
  });
  it("suppresses shortcuts in text inputs and dialogs", () => {
    expect(typingTarget(document.createElement("input"))).toBe(true);
    const dialog = document.createElement("dialog"),
      button = document.createElement("button");
    dialog.append(button);
    expect(typingTarget(button)).toBe(true);
    expect(typingTarget(document.createElement("main"))).toBe(false);
  });
});
