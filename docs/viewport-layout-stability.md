# Viewport layout stability — 6 November 2026

Continuation of the opt-in `?sizing=viewport` experiment. The branch remains `codex/timer-ui` in the permanent worktree. The normal `npm run dev` command is unchanged; the retained preview is at `http://127.0.0.1:5186/?sizing=viewport`. No push, PR, merge or deployment was performed.

## Findings before changes

The viewport-relative root kept rem-based visual dimensions stable, but the rest of the application still used CSS-pixel width breakpoints. Training's `xl` reference column, Flashcards' `lg` column, Settings' `lg` cube panel and `md` method columns, Setup's `lg` split layout, and responsive padding/width/display utilities therefore changed at native zoom. The Timer/shared shell already had their first-pass opt-in exceptions.

The React measurement audit found:

- `SubNavigation` used `useDesignPixels` to calculate a CSS-pixel inset and restarted its 180ms workspace animation whenever that number changed. Each zoom changed the root font and therefore the inset, despite the physical column staying the same size. Native traces recorded one unintended workspace slide per zoom step on each subnav page.
- Timer cube geometry combined independently updated root-scale state and measured pixel boxes. Other cubes used CSS-pixel numeric bounds, padding, rounding and 3D transforms. The Settings cube, for example, went from 380 physical px at 100% to 190 at 50% and 760 at 200%; intermediate measured sizes also appeared while measurements settled.
- `useElementSize` and `useElementWidth` feed cubes and Training's measured-width layouts, including the `SplitStage`/Trace Sprint width decisions. Their CSS-pixel values also changed with zoom.
- `VirtualHistory` had pixel-based row/windowing geometry. Ordinary scroll offsets stayed numeric CSS pixels while the root changed, so the visible history row and horizontal memo location changed even though data and popup state survived.
- `Popover` measures CSS coordinates for placement, not responsive mode selection; its coordinate system did not need an inverse transform. `feedbackContext.innerWidth` is diagnostic metadata, not a layout decision, and was left alone. Existing Timer `cqw` sizing naturally scales with its container once that container keeps the same arrangement.

## Signal measurements

Live native zoom was exercised in the same loaded document, rather than loading a new page for each factor. All seven main routes followed 100% → 50% → 80% → 125% → 150% → 200% → 100%.

Representative initial 1440×900 content-viewport signals:

| Zoom | Inner viewport | Chrome outer window | Firefox reported outer window | Reference width, Chrome / Firefox |
| ---- | -------------- | ------------------- | ----------------------------- | --------------------------------- |
| 100% | 1440×900       | 1458×996            | 1366×768                      | 1440.00 / 1440.00                 |
| 50%  | 2880×1800      | 1458×996            | 2732×1536                     | 1440.00 / 1440.00                 |
| 80%  | 1800×1125      | 1458×996            | 1708×960                      | 1440.00 / 1440.00                 |
| 125% | 1152×720       | 1458×996            | 1093×614                      | 1440.00 / 1440.94                 |
| 150% | 960×600        | 1458×996            | 911×512                       | 1440.00 / 1440.00                 |
| 200% | 720×450        | 1458×996            | 683×384                       | 1440.00 / 1440.00                 |

These are Windows headless-browser observations, not portable screen constants. Chrome's headless screen/available dimensions were 800×600 throughout; Firefox's screen/available dimensions varied with zoom. The first Firefox matrix used BiDi content-viewport sizing, so the reported outer window was a different size from that viewport. A separate native-client-window test was added to check actual Firefox window resizing and browser chrome explicitly.

`outerWidth`/`outerHeight` therefore did not offer one common zoom-independent content geometry. Screen/window fractions can stay stable but do not reveal how much room the application has in its own visual units. DPR includes display scale as well as page zoom. No product code uses DPR, screen dimensions, browser names, an initial-zoom assumption, or stored monitor calibration.

The chosen signal is **available viewport width in reference-root units**:

```text
referenceWidth = innerWidth × 19.2 / computedRootFontSize
```

Native zoom changes numerator and denominator together. An actual narrower window changes how many visual UI units fit. This is a content-density signal, not a claim to reconstruct an absolute unzoomed physical pixel width. The existing root-height tradeoff remains: proportional resizing at the same shape can keep the same layout while scaling the UI to fit.

This is the useful general principle behind csTimer's [shape-based layout decision](https://github.com/cs0x7f/cstimer/blob/master/src/js/kernel.js#L673-L689). BlindSolve retains its own breakpoint thresholds and existing contextual-sidebar density instead of replacing the whole application with csTimer's single threshold. [Window outer size includes browser chrome](https://developer.mozilla.org/en-US/docs/Web/API/Window/outerWidth); [BiDi separately exposes window and viewport controls](https://developer.mozilla.org/en-US/docs/Web/WebDriver/Reference/BiDi/Modules/browser).

## Implementation

`src/styles/viewport-layout.json` is the shared policy: existing 640/768/1024/1280/1536 width thresholds, the previous contextual-sidebar threshold expressed in reference units, and 2px hysteresis against fractional rounding near a boundary.

`viewportSizing.ts` resolves that policy into one `data-viewport-layout` token set. One resize source batches events into at most one scheduled animation-frame callback. It writes layout tokens and notifies React subscribers only when the logical mode changes. The existing fine-pointer/hover/landscape activation guard remains. There is no permanent frame loop, zoom polling, inverse CSS zoom or inverse scale transform.

The PostCSS adapter generates opt-in selectors for structural breakpoint declarations: display, columns, flex arrangement, bounds, position, spacing, overflow and text geometry. Existing Tailwind class names remain; the source components do not need hundreds of class replacements. The ordinary media-query rules remain effective outside the experiment. Colour/opacity rules and unrelated media queries, including reduced-motion preferences, retain their normal semantics. Unknown breakpoint widths are not silently reinterpreted.

The sidebar width is now CSS rem geometry. Its animation depends on a logical inset change (showing/hiding the contextual column), not a root-font recalculation. Intentional Timer→Settings navigation still invokes its workspace slide; zoom does not restart it.

Cube measurement reads the box and root in the same ResizeObserver delivery and stores coherent reference units. Both cube renderers express length geometry—including depth, gaps, radii, labels and outline lengths—in rem only when the experiment is active. CSS can then paint the correct size immediately; it does not wait for React to combine a new root scale with an old box. The underlying state, orientation, sticker selection, drag behavior and DOM/CSS 3D renderer remain intact. No raster scaling or deliberate resize debounce was added.

Scrolled elements retain anchors in root units through the same central resize path. Zoom-generated scroll events cannot overwrite the pre-zoom anchor. History row/spacer CSS uses rem, and active-mode virtualization calculations use coherent logical units. Data, timing and memo generation were not modified.

The Settings scroll-spy also needed its activation line and bottom tolerance expressed through the same reference scale. A boundary test reproduced a highlight change from Cube & lettering to Methods at 200% even with the content anchored; the normalized threshold prevents that change. This was tested through SPA navigation so the scroll-spy was actually attached, as well as with an explicitly selected Timer section.

## Results

Chrome 157.0.8103.38 and Firefox 159.0.1 each completed 49 live page/zoom observations and 14 separate resize/page observations. All requested main pages were included: Timer, Training, Letter Pairs, Flashcards, Settings, Setup and Sign-in. Test-only extensions set actual native page zoom in isolated profiles; no extension is shipped with the application.

There were **no layout-mode changes or landmark-count changes during zoom**. The following maximum absolute deviations cover the recorded nav, subnav, workspace, main/aside, cube, Timer, Settings section and dialog landmark rectangles, relative to each page's own 100% reference. They are physical-raster estimates from DOM bounds × measured test DPR, not pixel-by-pixel screenshot differences.

| Page         | Chrome maximum landmark drift | Firefox maximum landmark drift |
| ------------ | ----------------------------: | -----------------------------: |
| Timer        |                       0.031px |                        0.400px |
| Training     |                       0.031px |                        0.325px |
| Letter Pairs |                       0.141px |                        0.221px |
| Flashcards   |                       0.000px |                        0.058px |
| Settings     |                       0.031px |                        0.446px |
| Setup        |                       0.016px |                        0.333px |
| Sign-in      |                       0.000px |                        0.029px |

At the 1440×900, 100% reference, the recorded landmark geometry matched the previous prototype exactly in both engines. The separate default/experimental reference-geometry browser check also passed.

Finite frame traces ran for 850ms around each zoom transition. Before the fix, subnav pages restarted their workspace animation at each changed factor; afterward, all seven routes recorded zero zoom-triggered workspace slides. Within the sampled frames after each new DPR took effect, measured cube width had zero spread. Small differences between fractional Firefox zoom levels remain below one physical pixel. This is measured evidence against the previous bouncing geometry, not a guarantee about every compositor frame on every GPU.

Actual content resizing through 1440×900, 1280×720, 1024×768, 900×560, 390×844, 320×568 and back to 1440×900 changed the applicable layout tokens and restored desktop navigation afterward. Training loses the wide reference column at the 1024×768 density, and the portrait sizes use the existing mobile shell. The same geometry policy intentionally follows available root units rather than width alone, so a short 900×560 window can fit a denser layout than a taller narrow window.

Additional native Firefox window tests use `browser.setClientWindowState`, with browser chrome accounted for. The browser enforces a native minimum width near 500px in this environment; 390px/320px mobile widths are therefore tested through its content-viewport API, not falsely labelled native desktop-window sizes.

The populated-state checks use disposable guest fixtures and native zoom without reloads:

- 180 solves remained intact; the open Timer-mode popup stayed open.
- The scrolled history anchor stayed at row 20.8333; the horizontal memo anchor stayed at 416.6667 design units (fractional Firefox rounding below 0.007 units).
- The running Timer continued increasing through 100% → 200% → 50% → 100%.
- Memo Recall remained selected and retained its challenge ID.
- The unsaved Settings token `Z`, Lettering tab and the exact input DOM node survived every tested factor.
- The selected Settings section survived both a direct section choice and a near-boundary manual scroll position.

## Validation and evidence

- TypeScript project check passed.
- Eight sizing/policy/geometry unit tests passed, including the Autoprefixer pipeline and preservation of unrelated media queries.
- Ten existing/default and prototype responsive/reference/interaction browser cases passed.
- Two additional cases passed: intentional navigation still animates; real narrowing collapses navigation and restoring the window returns it.
- The existing 10,000-record Training history case passed with 21 mounted rows. The Timer case passed on a clean source-idle rerun with 42 mounted rows, keyboard Home/End behavior and about 433ms measured interaction time. Its initial run overlapped formatting/HMR and missed keyboard focus; that run is retained in the test artifacts rather than treated as a passing result.
- Native state assertions passed in both browsers (30 observations each, including the Settings section boundary).

Artifacts are ignored local files under `test-results/responsive-zoom/`: `before/`, `after/`, `state-before/`, `state-after/`, and `native-window/`. The `after/` matrix is the final valid full-page result; intermediate integration checks are not acceptance evidence. Use a dedicated Playwright output directory so new tests do not clear the audit folder.

```powershell
$env:ZOOM_ENGINE = 'chrome' # or firefox
$env:ZOOM_PHASE = 'after'
node scripts/responsive-zoom-audit.mjs
$env:ZOOM_PHASE = 'state-after'
node scripts/zoom-state-audit.mjs
$env:PLAYWRIGHT_BASE_URL = 'http://127.0.0.1:5186'
npx playwright test e2e/viewport-layout.spec.ts --output test-results/layout-animation-regression
```

## Scope and remaining limits

The experiment remains opt-in and keeps its existing landscape/fine-pointer activation policy. Portrait/touch continues using the original sizing and media queries; this is not a claim of native-page-zoom invariance in that fallback mode. The height-driven window-size tradeoff remains. Some fixed-pixel decorative icon/stroke details are outside this structural pass, so the result is not pixel-identical at every zoom. Physical multi-monitor movement and manual mobile address-bar animation were not tested. The native matrices are headless Windows tests, complemented by built-in-browser inspection; native browser minimum sizes are reported separately.

No backend, authentication flow, timer mechanics, cube-state logic, data model or production configuration was changed. There is no new dependency. Intentional animations and normal browser zoom shortcuts remain available.

Files changed for this continuation:

- Policy/build: `postcss.config.js`, `scripts/viewport-layout-css.mjs`, `src/styles/viewport-layout.json`, `src/magic/utils/viewportLayoutPolicy.ts`, `src/magic/utils/viewportSizing.ts`.
- Sidebar/cube geometry: `SubNavigation.tsx`, `useElementSize.ts`, `useElementWidth.ts`, `cubeGeometry.ts`, `Cube3D.tsx`, `SchemeCube.tsx`, `CubeConfigurator.tsx`, `WorkspaceTimer.tsx`; Settings scroll-spy geometry in `Settings.tsx`.
- Scroll geometry: `VirtualHistory.tsx`.
- Verification: `src/styles/viewportLayout.test.js`, `e2e/viewport-layout.spec.ts`, `scripts/native-browser-session.mjs`, `scripts/responsive-zoom-audit.mjs`, `scripts/zoom-state-audit.mjs`.
- This report and links from the sizing documentation. All pre-existing unpublished work was preserved.
