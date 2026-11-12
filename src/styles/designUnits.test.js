import { describe, expect, it } from "vitest";
import postcss from "postcss";
import uiDesignUnits, { designUnits } from "../../scripts/ui-design-units.mjs";

describe("central design units", () => {
  it("scales pixel tokens through rem while keeping other units and CSS variables intact", () => {
    expect(
      designUnits(
        "clamp(12px, 3vw, 40px) calc(100% - 16px) var(--size-16px) -1px 0px",
      ),
    ).toBe(
      "clamp(0.75rem, 3vw, 2.5rem) calc(100% - 1rem) var(--size-16px) -0.0625rem 0rem",
    );
  });
  it("does not rewrite asset URLs or literal content", () => {
    const value = `url("data:image/svg+xml,<svg width='16px'></svg>") "12px" 8px`;
    expect(designUnits(value)).toBe(
      `url("data:image/svg+xml,<svg width='16px'></svg>") "12px" 0.5rem`,
    );
  });
  it("retains viewport media queries and protected physical cube geometry", async () => {
    const result = await postcss([uiDesignUnits()]).process(
      "@media(min-width:768px){.button{width:32px}.timer-cube-viewport{height:clamp(170px,36vh,330px)}.cube-utility-control{height:28px}.cube-utility-control svg{width:15px}}",
      { from: undefined },
    );
    expect(result.css).toContain("min-width:768px");
    expect(result.css).toContain("width:2rem");
    expect(result.css).toContain("height:clamp(170px,36vh,330px)");
    expect(result.css).toContain("height:28px");
    expect(result.css).toContain("width:15px");
  });
});
