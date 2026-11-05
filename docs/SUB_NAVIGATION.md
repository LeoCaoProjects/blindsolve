# Shared sub-navigation

Training, Settings and Letter Pairs use the persistent `SubNavFrame` in the route shell. Pages render their existing state-driven controls through `SubNavigation` into that column; they keep ownership of their state, callbacks and dialogs. Timer and other pages have zero contextual-column width.

- Width: `SUB_NAV_WIDTH = 224` in `src/magic/components/layout/SubNavigation.tsx`, reduced from Training's previous 264px. It fits the longest labels with comfortable padding and gives the exercise more room.
- Desktop: the real flex-column width commits once to 0 or 224px. A translation visually moves the workspace from its previous position without scaling text or animating layout dimensions. Navigation between contextual pages preserves the same column and width; only its contents change.
- Motion: workspace translation 180ms, content opacity 160ms, Pieces/Show shared sliding indicator 180ms. All use cubic-bezier `(0.22, 1, 0.36, 1)` without a spring. Reduced motion sets these durations to zero.
- Narrow screens: below 1024px, each page has one contextual-navigation trigger opening the existing Sheet component. No empty desktop column is reserved. Choosing a Settings section or letter closes its sheet; Training keeps the sheet open for mode/scope/display adjustments.
- Styling: shared row padding, typography, active surface, section heading hierarchy, overflow and focus treatment use the current application theme. No global font or colour changes.

## Page changes

Training removes only the four redundant navigation descriptions. Its four modes, Pieces and relevant Show controls use the existing Training session. Pieces and Show use a single moving background per control via a unique Framer Motion `layoutId`; the selection text remains responsive while the background moves. The tutorial components/data remain unchanged.

Settings supplies its six existing section actions and scrollspy state. The setup route stays a separate utility link beneath the sections. The workspace has no internal navigation column or old reserved left footer padding. Staged setup changes, immediate preferences, loading, saving and leave confirmation retain their original handlers.

Letter Pairs supplies its existing tokens, selected token and computed counts. A compact two-column grid places each token beside its quieter count. Its thin scrollbar has a transparent track and stable gutter. It scrolls independently and keeps the selected entry visible without scrolling the animated shell. Existing pair-grid keyboard behavior stays unchanged; the token index also has a roving tab stop and Up/Down/Home/End navigation.

## Changed implementation

- `src/magic/components/layout/SubNavigation.tsx`: shared persistent frame, responsive surface, width/motion/row tokens.
- `src/magic/App.tsx`: mount that frame outside the route switch.
- `src/magic/components/training/TrainingHeader.tsx` and `src/magic/pages/Training.tsx`: shared contextual navigation and sliding selection polish.
- `src/magic/pages/Settings.tsx`: navigation conversion and workspace alignment.
- `src/magic/components/pairs/FirstTokenRail.tsx` and `src/magic/pages/LetterPairs.tsx`: contextual token index.
- `e2e/latest-ui.spec.ts`, `e2e/sidebar-training.spec.ts`: update expected removed copy and requested width, preserving behavior checks.
- `e2e/sub-navigation.spec.ts`: actual frame-by-frame layout/indicator motion, stable contextual width, reduced motion, all six requested viewports, Settings actions/setup, every token/count and keyboard navigation.

Verification uses isolated guest fixtures; it does not modify the user's production account. The original ZIP remains retained in `docs/design-reference/magic-patterns-previous.zip` as a presentation reference.

## Verification

The integrity/performance pass passed 222 unit tests, the full existing 43-test browser suite, and 21 focused checks against the final build (including overlapping sub-navigation tests). Type checking, production build, lint and SEO checks passed. The combined CI suite includes 57 browser tests. Coverage includes 1440x900, 1280x720, 1024x768, 900x560, 390x844 and 320x568, measured intermediate workspace/indicator positions, reduced motion, stable contextual width, scramble geometry, equal control segments and horizontal containment.


## Static global navigation anchor

`GlobalNavigationShell` renders the global rail/mobile dock as a persistent sibling of `RouteFrame`, outside `SubNavFrame` and its translated page workspace. A transform creates a containing block for fixed descendants: rendering the rail inside a page previously moved it with the FLIP transform, then snapped it back when that transform ended. The navigation must never return to that transformed subtree.

Page `AppBar` components retain page-specific header controls and register their shortcut handler/activity dimming with the shell. Global navigation links, route guards, shortcut access and responsive styles retain their existing behavior. No counter-transform or compensating offset is applied to the rail/dock.

`e2e/global-navigation-anchor.spec.ts` checks every requested route transition at all six viewport sizes. Each animation frame must retain the same visible navigation DOM node, exactly the same bounding rectangle, no transformed ancestor and no duplicate visible navigation. Contextual-to-contextual transitions must preserve the 224px column and workspace position. The existing motion/reduced-motion tests remain intact; the new regression fails on the previous production build. A separate check verifies page-owned shortcut dialogs still open from the persistent global button.
