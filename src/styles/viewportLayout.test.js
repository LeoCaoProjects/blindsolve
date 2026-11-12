import { describe, it, expect } from "vitest";
import postcss from "postcss";
import autoprefixer from "autoprefixer";
import viewportLayoutCss from "../../scripts/viewport-layout-css.mjs";
import {
  layoutTokens,
  referenceViewportWidth,
} from "../workspace/utils/viewportLayoutPolicy";
import { cubeGeometry } from "../workspace/utils/cubeGeometry";

describe("viewport layout policy", () => {
  it("keeps the available layout width through page zoom but responds to narrower windows", () => {
    const baseline = layoutTokens(referenceViewportWidth(1440, 19.2));
    for (const zoom of [0.5, 0.8, 1, 1.25, 1.5, 2])
      expect(
        layoutTokens(
          referenceViewportWidth(1440 / zoom, 19.2 / zoom),
          baseline,
        ),
      ).toBe(baseline);
    expect(
      layoutTokens(referenceViewportWidth(900, 19.2), baseline),
    ).not.toContain("lg");
  });
  it("holds a breakpoint through subpixel noise without freezing genuine resizes", () => {
    const wide = layoutTokens(1024);
    expect(layoutTokens(1023.1, wide)).toContain("lg");
    const narrow = layoutTokens(1021, wide);
    expect(narrow).not.toContain("lg");
    expect(layoutTokens(1025, narrow)).not.toContain("lg");
    expect(layoutTokens(1027, narrow)).toContain("lg");
  });
  it("scopes structural CSS to one opt-in layout source and preserves unrelated media", async () => {
    const css =
      "@media (min-width:1024px){.panel{display:grid;grid-template-columns:1fr 20rem;color:red}}@media(prefers-reduced-motion:reduce){.panel{animation:none}}";
    const result = await postcss([viewportLayoutCss(), autoprefixer()]).process(
      css,
      { from: undefined },
    );
    expect(result.css).toContain(
      ":where(html:not([data-viewport-sizing])) .panel",
    );
    expect(result.css).toContain(
      ':where(html[data-viewport-sizing][data-viewport-layout~="lg"]) .panel',
    );
    expect(result.css).toContain("color:red");
    expect(result.css).toContain(
      "@media(prefers-reduced-motion:reduce){.panel{animation:none}}",
    );
  });
  it("does not reinterpret unknown width queries or explicit prototype overrides", async () => {
    const css =
      "@media(min-width:777px){.x{display:grid}}@media(min-width:768px){html[data-viewport-sizing] .x{display:flex}}";
    expect(
      (await postcss([viewportLayoutCss()]).process(css, { from: undefined }))
        .css,
    ).toBe(css);
  });
  it("converts only cube length geometry, retaining functional unitless properties", () => {
    const input = {
      width: 192,
      perspective: 384,
      opacity: 0.5,
      transform: "rotateY(90deg) translateZ(96px)",
      boxShadow: "inset 0 0 0 1.92px red",
    };
    expect(cubeGeometry(input, false)).toBe(input);
    expect(cubeGeometry(input, true)).toEqual({
      width: "10rem",
      perspective: "20rem",
      opacity: 0.5,
      transform: "rotateY(90deg) translateZ(5rem)",
      boxShadow: "inset 0 0 0 0.1rem red",
    });
  });
});
