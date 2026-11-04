# Previous Magic Patterns design reference

`magic-patterns-previous.zip` is the original user-supplied export (4 November 2026). Retain it for future component-by-component presentation work. Its mock state, timers, auth, data and instructions are not production authority. Current BlindSolve main remains the functional source of truth.

## Components used in this change

- `src/components/shell/NavRail.tsx`: 72px rail, 56px links, icon/label sizing, spacing, active/hover styling, bottom Settings and shortcuts. BrandMark removed entirely, with no replacement logo. Prototype AccountDot omitted because the existing Settings account controls remain authoritative.
- `src/components/shell/MobileDock.tsx`: 56px five-column phone dock and safe-area inset. Navigation stays accessible during drills; production navigation/state preservation takes precedence over prototype quiet-mode hiding.
- `src/components/training/ModeList.tsx`: mode button markup, padding, rounded corners, two text sizes and descriptions. Laid out in two/four columns to fit the existing Training top area without replacing its stage/history layout. The mode list collapses behind a button on short screens and scrolls internally when expanded.
- `src/pages/Training.tsx` Pieces area and `src/components/ui/Segmented.tsx`: compact bordered switch, inverted selected segment, Both/Edges/Corners order. Existing Show control and clocks retained.

All presentation uses existing BlindSolve colour/font tokens. Routing uses real Links with the existing Settings navigation guard; callbacks still come from the live pages. Main page roots fit the shell's available height, reserving room for the rail/dock. Setup/sign-in retain their existing full-screen layout.

No prototype HelpSheet, tutorial data, business logic, routing, global styles, dependencies, cube or history components were imported. Existing TrainingHelp, TrainingIdle and trainingModes guidance stay unchanged.

## Verification and changed files

Archive SHA-256: `5702e3c945f04a59e88d21f5260bcacf06ba1071ec3799681782e80d29d11e62` (matches the original download).

Implementation files:
- `src/magic/components/layout/AppBar.tsx`: adapted rail/mobile dock and real navigation guard.
- `src/magic/data/navigation.ts`: original prototype icon choices, with real destinations.
- `src/magic/components/training/TrainingHeader.tsx`: adapted mode/Pieces selectors; existing clocks and Show retained.
- `src/magic/App.tsx`: reserve space for navigation on main routes.
- `src/magic/components/concepts/workspace/WorkspaceTimer.tsx` and `src/magic/pages/{Training,LetterPairs,Flashcards,Settings,FeedbackInbox}.tsx`: one-line height adjustment to fit reserved navigation space.
- `e2e/latest-ui.spec.ts`: expected mode text now includes the imported descriptions; existing behavior assertions retained.
- `e2e/sidebar-training.spec.ts`: added route/back-forward, responsive, mode/scope, keyboard, original tutorial and Settings leave-guard coverage.
- `docs/design-reference/{README.md,magic-patterns-previous.zip}`: retained source and integration record.

Validated using isolated guest browser fixtures rather than the user's production account. Existing account/hydration unit coverage remains in the full unit suite. No live signed-in account was modified. Visual checks include desktop, phone, 320px-wide and short landscape screens; the mode chooser collapses on screens at most 640px tall. No new horizontal document overflow or unresolved visual issue was found in those checks.
