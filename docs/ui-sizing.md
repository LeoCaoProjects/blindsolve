# UI sizing

The opt-in prototype now has a centralized responsive-layout policy and coherent cube/scroll geometry. See [viewport-layout-stability.md](viewport-layout-stability.md) for the continuation results and limits; the earlier root-sizing report remains historical context.

The default remains the 120% root below. A local opt-in viewport-sizing experiment is available with `?sizing=viewport`; see [viewport-sizing-prototype.md](viewport-sizing-prototype.md) for the measured results, reference-height calibration, mobile fallback, and current limitations. It is not enabled by default.

BlindSolve uses a 120% root font size. One rem is normally 19.2 CSS pixels, giving the existing UI its preferred larger baseline at normal browser zoom.

Tailwind spacing already uses rem. `scripts/ui-design-units.mjs`, run after Tailwind in PostCSS, converts legacy pixel values in CSS declarations into rem at 16 design pixels per rem. It leaves quoted content, asset URLs and media queries unchanged. Breakpoints continue to depend on viewport width/height. There is no page transform, CSS zoom or browser-zoom interception.

For inline design dimensions, use `designRem` from `useDesignPixels.ts`. For algorithms that measure DOM pixels (history windowing and contextual navigation), `useDesignPixels` bridges the root typography scale into actual CSS pixels. Do not multiply measured DOM rectangles again.

The Timer cube is an intentional exception: `.timer-layout`, `.timer-cube-viewport` and `.timer-reference-column` preserve the physical reference-column width, cube viewport height and border widths. Cube rendering still uses the original measured content box and size formula. Utility controls are positioned absolutely and reserve no cube space.

The short-phone Timer rule applies only below 768px wide and 641px tall. It compacts scramble typography/padding and the stats strip so the clock remains visible, without changing the memo footer's stable height or horizontal overflow.

Normal UI selection is disabled centrally in `src/magic/index.css`; editing surfaces explicitly retain text selection. Browser titles come from `src/seo/site.json` at build time, with no route-driven `document.title` assignment.

Favicon provenance and the retained MIT license are in `docs/third-party/cubing-icons`. Run `node scripts/render-favicons.mjs` to regenerate PNG/ICO variants from the SVG using the existing Playwright installation.

The restored cube utilities deliberately retain the 40px letter button with a 4px radius and the original Lucide glyph rendered at 20px. The letter control sits 16px from the right and 8px from the bottom. Mode labels share `CubeUtilityButton` styling; Aa remains its original vector artwork, not substituted text. At effective viewports below 768px wide and 481px tall, Timer regions scroll vertically rather than clipping the clock; the fixed memo footer design is unchanged.
