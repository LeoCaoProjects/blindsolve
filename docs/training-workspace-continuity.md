# Training workspace continuity

Local iteration on `training-ui`, carried from the working viewport-sizing baseline. No push, PR, merge, or deployment.

## What changed

`SessionWorkspaceFrame` uses one persistent `SubNavFrame`, scramble header, reference panel, measured cube, and Aa control for Timer and Training. Route changes update their data instead of replacing the cube/header. The reference panel stays outside the translated contextual workspace. The shared header is inside `[data-page-workspace]` with the central content, so both follow the same existing 180ms ease-out slide. Training's subnav remains full-height, and the header's available width follows the contextual column. Timer's header stays at its original position. The earlier placement above the animated workspace excluded the header from that inset; this correction removes that cause of overlap without adding a second animation.

`WorkspaceScrambleHeader` is extracted from Timer, retaining its refresh icon/button, padding, typography, loading/error states and disabled behavior. Training no longer adds a scramble number or visible N hint. The keyboard shortcut remains functional.

`SessionReadout`, `VirtualHistory`, and shared row styles provide the same stats, row density, padding, hover treatment and scrolling family. Training retains its own correctness, pair/target fields, durations and deletion behavior. It uses one history column for these fields; Timer retains its original two-column solve history.

The cube, viewport, utility anchor, and measurement formula are Timer's originals. Training has Aa but no Timer mode control. Execution/Guided hide the challenge once an attempt starts; Memo Recall retains the study/recall concealment rules and uses its inline cube only when the reference column is hidden. Trace Sprint retains its central interactive cube and has no blank reference-cube slot or scramble header. No BLD mechanics or session hooks changed.

A small supporting fix changes scramble move widths from 3.7ch to 2.22em, the same loaded JetBrains Mono advance. This prevents the fallback font from changing the reserved loading row count on a 320px phone. No font, size, or typography design changed.

## Measured cause and result

At a 1440x900 desktop content viewport, before this iteration:

| Landmark | Timer | Training Execution / Guided |
| --- | --- | --- |
| Scramble header x / width / height | 86.391 / 961.609 / 146.047 | 355.188 / 739.219 / 164.594 |
| Right panel x / width | 1048 / 392 | 1094.406 / 345.594 |
| Cube x / y / size | 1108.5 / 25.5 / 272 | 1137.703 / 31.5 / 260 |
| Aa x / y / size | 1384 / 275 / 40 | absent |
| History y | 408.375 | 408.375 |

Different grid widths (Timer 28vw, Training 24vw), cube sizing formulas, independent remount/measure cycles, and the reference panel living inside the translated page caused the discontinuity. Training also used a separate numbered scramble header with different padding and controls.

The right-panel, cube, Aa and history landmarks match Timer's prior bounds across Timer, Execution Sprint and Guided Solve. Shared row height is 43.1875 CSS pixels (36 design units at this reference root). The header and cube retain DOM identity across three repeated Timer/Training cycles. Frame samples through each transition record the reference panel at x=1048, y=0, width=392 throughout. Timer's normal desktop geometry is preserved. Following the correction pass, Training's header intentionally starts at the contextual workspace's x coordinate and uses its available width instead of matching Timer's absolute header bounds.

## Small correction pass

Both CSS cube renderers (`Cube3D` and `SchemeCube`) previously used `transform 260ms cubic-bezier(0.23, 1, 0.32, 1)` on the camera wrapper. That tween is now disabled at the source. Saved-camera/reset changes flush in a layout effect before paint; drag interaction, cube sizing, colours, letters and separate sticker/highlight transitions remain intact. The old optional `instant` prop is retained for caller compatibility, but camera updates are always instant.

Correction validation: typecheck and five focused browser cases passed, covering repeated Timer/Execution/Guided switching, sampled 0/90/180ms workspace animation positions in both directions, stationary reference-panel geometry, Memo Recall without a scramble header, cube drag and orientation resets, saved orientation changes in both renderers, and the existing 390x844 and 320x568 narrow checks. The orientation assertions check zero transition duration, no active transform transition, and the computed matrix already at the target matrix (within CSS serialization precision). Evidence is in `test-results/training-correction-recheck` and `test-results/training-correction`.

## Targeted validation

- TypeScript build/typecheck.
- New shared workspace test: repeated route switching, shared node identity, header/cube/Aa/reference/history bounds, control state, and absence of Training's Timer selector.
- New narrow checks: Timer and all four Training modes at 390x844 and 320x568.
- Existing header loading/ready/error geometry cases for Timer and Training at 1440x900 and 320x568. Initial phone runs exposed the fallback-font slot issue; all four passed after correction.
- Existing lifecycle cases: Guided flow, Execution DNF persistence, shared-scope SPA state, Memo Recall/Trace hold-release and Next, Timer timing/reconstruction save, and disabled-live-timer display.
- Existing subnav animation/root-scale and real narrowing/restoration checks. An initial Timer-to-Settings slide failure exposed a remount in the new wrapper; the nav frame is now persistent across all routes.
- One native Chrome sanity check, limited to Timer/Execution/Guided: 100% -> 200% -> 50% -> 100%, shared physical landmark drift below 0.5px, plus a native 900px window narrowing and desktop restore.
- Built-in browser visual inspection of Timer and Training. No full-app certification matrix or production build.

Evidence: `test-results/training-continuity/after/` (screenshots and switching geometry), `test-results/training-continuity/zoom/chrome.json` (native zoom samples), and focused Playwright output directories. Native checks used an isolated disposable browser profile.

## Files changed in this iteration

- `src/workspace/App.tsx`
- `src/workspace/components/layout/SubNavigation.tsx`
- `src/workspace/components/workspace/SessionWorkspaceFrame.tsx` (new)
- `src/workspace/components/workspace/WorkspaceScrambleHeader.tsx` (new)
- `src/workspace/components/workspace/historyStyles.ts` (new)
- `src/workspace/components/workspace/WorkspaceTimer.tsx`
- `src/workspace/components/workspace/WorkspaceHistory.tsx`
- `src/workspace/components/training/TrainingAside.tsx` -> `TrainingHistory.tsx`
- `src/workspace/components/training/MemoRecallWorkspace.tsx`
- `src/workspace/components/solve/ScrambleRegion.tsx`
- `src/workspace/components/solve/ScrambleText.tsx`
- `src/workspace/components/cube/Cube3D.tsx` (instant orientation correction)
- `src/workspace/components/cube/SchemeCube.tsx` (instant orientation correction)
- `src/workspace/pages/Training.tsx`
- `src/workspace/index.css` (short-phone selectors follow the extracted main wrapper)
- `e2e/training-workspace.spec.ts` (new)
- this report

Existing unrelated working changes, including viewport-default activation, Settings, favicons and SEO, were carried over unchanged.

## Training tab geometry and Memo Recall timing

Local `training-ui` correction: the persistent scramble and cube regions now use TrainingRegion, which animates their real in-flow height with the same 180ms ease-out curve as the subnav. Only Training mode changes animate; timing-phase and route changes settle immediately, preserving the corrected Guided execution anchor. Regions retain their real DOM, are inert/aria-hidden when collapsed, and finish at zero height or auto. There are no cloned panels/cubes, fixed screenshot overlays, resize polling or continuous animation monitors. Native playback completion only clears a transient transition marker. Reduced motion settles immediately.

The idle Fade is no longer keyed by mode. The same TrainingIdle/readout remains mounted while its layout position responds to the height change and description wrapping. The empty desktop idle dock is hidden for all modes. Numeric active-stage measurements are attached only outside idle, so idle region animations do not feed intermediate ResizeObserver dimensions into the timing workspace. The existing subnav slide is unchanged.

The right column retains one cube and one TrainingHistory surface. Trace collapses the cube region so history rises from y324 to y0 at the checked desktop viewport; reversing restores it without changing panel width. The inner cube viewport keeps its normal size during clipping, and Cube3D's instant orientation implementation is untouched. Memo Recall now uses the standard reference cube geometry/dimming; its existing Aa lock during recall is preserved. History rows keep the shared density, passive hover, delete control and explicit default cursor.

Memo Recall's old timer strip/legacy timing branch was removed. Study uses ExecutionWorkspace, and recall entry uses the same TrainingTimedStage and CompactTrainingTimer with the existing inputs, refs, Enter progression and validation. Both clocks use the existing showLiveTimer preference and TimerReadout rule. The shared timing grid keeps study/recall clocks in the central active anchor. Trace's existing timing mechanics are unchanged.

RecallReview now reuses SolveSummary's date, main time and typography, with restrained existing targets/memo/recall metadata and Correct/Incorrect status. Its primary time is the saved memo duration (or the current memo elapsed value), matching history. The answer comparison, word editor, pending edits, suggestions, Save/Cancel, Next and persistence functions are unchanged. No fields or new analytics were added.

Validation: TypeScript, five focused unit checks and eleven distinct targeted browser checks passed. The browser suite samples intermediate frames for all ten requested directed tab transitions, verifies mounted timer/cube/history identity and stable subnav/panel rectangles, tests rapid reversal and reduced motion, stale Space cancellation and editable ownership, Memo Recall live timing ON/OFF with correct inputs and saved results, unsaved-word cancellation and real word saving with spaces, passive hover/delete, 390x844 and 320x568 touch flows for Memo/Trace, and one native 150% zoom check. Three supporting regressions confirm unchanged Guided compact/idle execution geometry and Execution completion/history/date behavior. Evidence: test-results/training-continuity-geometry, training-continuity-memo-final, training-continuity-flow-final and training-continuity-regression. Built-in browser inspection confirmed the Trace/Recall panel continuity; desktop and phone study/entry/review screenshots were inspected. No full-app matrix, push, PR, merge or deployment. Localhost remains http://127.0.0.1:5186.

## Focused Memo Recall result and answer cleanup

Memo Recall now renders SolveDetailsShell itself, including the identical Guided Delete attempt / Close footer. Its shared SolveSummary shows the existing memo time or automatic DNF and one target-accuracy metric. The old Correct/Incorrect status, PairDiff Expected/Yours columns and per-letter orange error decoration are no longer rendered by Recall. The entire Worth a look / missing-word count / Show all words / editor/suggestion feature was removed, including its local draft state and the now-unused pending-word branch in ReviewPanel. Trace retains its existing non-editing review behavior.

Reconstruction uses the existing SolveMemoView/MemoTrace and useTrainingMemo adapter. An optional incorrect-pair flag adds only a subtle outline using the existing danger token at 40% opacity; letters keep their normal colour and decoration. Missing or mismatched positions outline the expected pair, while extra recalled targets appear as extra outlined pairs. Default rendering for Timer/Execution/Guided is unchanged.

Accuracy is exact matching positions divided by the number of expected individual tokens. Multi-character tokens count once; odd trailing targets count once; extra responses still cause DNF without enlarging the denominator. The existing persisted accuracy ratio is exposed in the UI Attempt projection, and history derives its integer numerator from that ratio and the already stored target count. No new stored field, string, table or payload was introduced. Legacy failed rows lacking a recorded ratio show an unknown numerator rather than an invented count. Memo history removes tick/cross icons, shows automatic DNF for incorrect attempts, and uses X/Y targets.

Memo study uses exactly the Guided memo timing geometry and shared showLiveTimer behavior. Its desktop Ready button is hidden, retaining the same touch-only fallback as Guided. In answer entry, Show answer and Submit were the same submit callback; only one plain Submit remains, attached beneath the fields. Enter progression and Escape's reveal capability remain unchanged. The fixed answer dock and visible key hint were removed.

Measured clipping cause: the full-width field ended exactly at the overflow-y:auto scrollport edge, but global focus-visible styling extended another 2px outline plus 2px offset beyond it. The answer grid/fields now have min-width:0 and a small shared-form inset with a 4-CSS-pixel minimum for focus clearance at high zoom, while retaining their natural available width. This is padding for the existing outline, not a narrow fixed-width workaround.

Validation: typecheck, nine focused unit checks and fourteen distinct targeted browser cases passed. Coverage includes correct/incorrect/extra-token results, exact Guided footer equality, individual-target scoring and existing saved schema, passive history hover/delete/reload, unclipped fields and attached Submit at desktop/390/320, Enter/button submission, shared Guided memo geometry and live timer ON/OFF, Escape/Space close, one native 200% focus-visibility check, retained ten-path Training layout transitions, Trace submission, and default Execution reconstruction. Evidence: test-results/memo-recall-cleanup-run1 (six passing cases; corrected DNF assertion in memo-recall-dnf-final), memo-recall-extra-final, memo-recall-focus-zoom-final, and memo-recall-cleanup-regression. Native browser inspection confirmed direct tab-to-Space start and full field outlines; the unsubmitted browser review attempt was discarded by reload without adding a history record. Localhost remains http://127.0.0.1:5186 on training-ui; no push, PR, merge or deployment.
