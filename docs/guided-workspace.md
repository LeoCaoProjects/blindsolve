# Guided Solve: direct Timer inspector and Execution timing correction

Local `training-ui` work only. No push, PR, merge or deployment.

## Completion

Guided now renders **`WorkspaceSolveDetails` itself**, the component used by clicking a saved Timer solve. It supplies the live Guided duration, real memo split, current scramble, memo pairs/words and completion date through the existing `Solve` presentation shape. The component's actual `SolveSummary`, `SplitMeter`, `SolveMemoView`, cube, scrim, footer, date formatter, styles and animations render the UI. There is no Training-specific popup layout, extra phase-times section, count grid or custom reconstruction markup for Guided.

The only result-content adaptation is that Guided supports OK/DNF, so its result control omits the unsupported +2 choice. Timer retains its three original choices and original keyboard mapping. The shared inspector accepts optional label/result choices, without changing Timer defaults or visual styling.

The standalone Did you solve the cube? / Solved / DNF screen and its buttons were removed. Stop enters the existing internal report state and mounts the inspector immediately. Result selection happens inside that inspector. Close confirms the selected physical outcome exactly once through the existing `finishGuided` function, then uses the existing idle/reset flow. There is no automatic next start. Delete discards the pending attempt. The internal result state/guards, timing, target generation and save payload are preserved; no new persistence or snapshots were added. The former review-ID association change in the Guided writer was removed because this live adapter needs no stored-record lookup.

`GuidedSolveReview` owns only temporary popup result/date/settled UI state. Reconstruction uses the existing live view adapter `useTrainingMemo`, shared with Execution's rendering. No historical Guided popup is introduced.

## Initial memo/timing phase

Guided memo renders the actual **`ExecutionWorkspace`** with its memo elapsed value, active tone, and an accessible Memorisation timer label. Timer placement, typography, size, line height, padding, target presentation and whitespace therefore come from the same implementation as Execution Sprint. The previous visible Memorisation heading, separate timer implementation and Guided-specific memo layout were removed. No visible extra phase label/box was added; the existing Start execution control conveys the next action.

Execution defaults/behavior remain unchanged. Guided's subsequent execution still uses the Timer readout and its existing Stop action. Shared header/subnav, right panel, cube/Aa anchors, passive hover history and orientation rules are untouched.

## Targeted validation

TypeScript and seven focused browser cases passed:

- Guided successful completion opens the popup directly, has no old Solved buttons or intermediate prompt, uses Timer reconstruction, and records one unchanged-shape Guided attempt on Close.
- DNF selected in that same popup records the existing failure outcome once on Close.
- Execution active versus Guided memo: same computed font properties and settled timer/cube/reference/Aa rectangles, within 0.15px. Entry-motion settling is accounted for in the test.
- Guided flow and result fit at 390x844 and 320x568.
- Existing Execution completion/history/date/Timer-popup parity regression.
- Existing Guided keyboard flow/reload regression, updated for result selection occurring inside the popup.

The sequence assertion reads all active targets from the accessible sequence labels and compares them with Timer's pair-over-word rendering, ignoring the renderer's screen-reader cycle-marker annotation. Existing millisecond split rounding is preserved.

Built-in browser inspection confirmed the immediate inspector and active memo layout. The temporary demo was discarded without adding a history record. No full-app/cross-browser matrix was run.

Evidence: `test-results/guided-timer-popup-recheck`, `test-results/guided-direct-timer-regression`; screenshots in `test-results/guided-workspace/` include Execution/memo comparison and OK/DNF results.

## Files changed in this correction

- `src/magic/components/training/ExecutionWorkspace.tsx` (optional visual timing props; defaults unchanged)
- `src/magic/components/training/GuidedSolveWorkspace.tsx`
- `src/magic/components/training/review/GuidedSolveReview.tsx`
- `src/magic/components/training/review/TrainingAttemptDetails.tsx` (unused Guided branches removed)
- `src/magic/components/training/TrainingMemoView.tsx` (reuse the existing memo adapter as a hook)
- `src/magic/components/concepts/workspace/WorkspaceSolveDetails.tsx` (optional content labels/result choices)
- `src/magic/components/solve/SolveSummary.tsx` (pass through optional result choices)
- `src/magic/hooks/useDetailsKeys.ts` (choice-aware shortcuts; Timer defaults unchanged)
- `src/magic/hooks/useTrainingSession.ts` (revert the now-unused Guided review-ID association)
- `src/magic/pages/Training.tsx` (open Guided inspector directly in report state)
- `e2e/guided-workspace.spec.ts`
- `e2e/latest-ui.spec.ts`
- This report.

Localhost remains `http://127.0.0.1:5186/training`; select Guided Solve. Normal npm run dev command is unchanged.

## Space ownership and stable active layout

The follow-up interaction correction removes the blanket focused-button exclusion that blocked Space after selecting a Training mode. Both idle hold/release and active phase progression now use the same Training Space ownership rule: navigation yields Space, native editable controls and action buttons retain their normal handling, and dialogs block workspace timing. Hold cleanup cancels the timer/state on mode deactivation and window blur, so a fresh press is required after switching modes.

Execution and Guided timing docks are hidden for a fine pointer with hover, without reserving desktop dock height. Touch devices retain the existing progression buttons and hold-to-start surface. Guided execution also uses the shared Execution surface: a grid ties the timing zone to 42% of the available stage height, followed by targets and a flexible lower gutter. Content can scroll on small screens. Memorising/Solving feedback occupies the same line in both Guided phases. Blind execution still conceals the memo while retaining its geometry, so no answers are exposed and phase changes do not shift the timer/target area.

Validation: typecheck and 11 targeted browser cases passed (`test-results/training-space-final`). These cover immediate Space after focused tab selection, direct repeated mode switches, stale hold cancellation, native input/textarea/select/contenteditable handling, the existing real Training input, Guided navigation preservation, desktop button removal, unchanged completion/history/delete behavior and saved payloads, matching active timer/cube/panel/Aa geometry, no Guided phase jump, and actual touch hold/progression in both modes at 390x844 and 320x568. Desktop/phone screenshots were inspected. No full-app or cross-browser certification matrix was run. Localhost remains at http://127.0.0.1:5186.

## Guided execution size, hold visuals and popup dismissal

Guided memo retains its compact Execution presentation. Execution restores the prior Guided/Timer formula: `clamp(48px, min(18cqw, 19vh), 176px)`, 0.9 line height and -0.06em tracking. The solve readout grows upward within the existing compact clock slot, preserving the target anchor even at 320x568. The shared stage timing track changed from 42% to 37%, raising both modes' targets by 5% of stage height (41.34px at the checked desktop viewport).

The portaled Training subnav was outside page-owned navigation dimming. SubNavFrame now accepts the readiness opacity for its desktop column/mobile trigger. Training's reference column uses Timer's existing 40% readiness opacity with its existing 300ms transition, rather than separately dimming history to 60% while leaving the cube bright. Cube disappearance did not reproduce in the original held-state screenshot; the original concealment condition applied after the active drill began. Hold is now explicitly excluded from that concealment condition. Browser checks verify the cube remains mounted/visible at exactly the same geometry throughout hold.

`useDialogSpaceClose` supplies one shared capture-phase Space shortcut to the solve shell, Inspector, Sheet, ShortcutSheet, Popover and confirmation cancel path. Existing Escape handlers and UI are unchanged. Editable fields and controls that own Space keep their native behavior. Held-key repeats cannot close a newly opened popup; a closing keydown and its repeats/release are consumed even after unmount, preventing timing behind the popup. Close callbacks keep existing semantics and no new data logic was added.

Targeted evidence: `test-results/training-polish-final`, hold screenshots and `test-results/guided-large-execution.png`. Nine browser cases passed, including both touch phone widths, all three requested popups, Escape, editing and result controls, no opening-Space dismissal, no background timing, Guided size/geometry, Timer hold parity and Execution completion/history/delete regression. No full-app or cross-browser matrix.

## Exact idle anchor, visible active cube and shared live-timer preference

The next correction raises the shared compact timing/target track from 37% to 27% of the available stage height: 10 percentage points, measured as 82.68px at 1440x900. Guided memo keeps the compact Execution timer. Guided execution now uses the actual TrainingIdle readout and its complete responsive idle layout, including the original description and scramble-header space. Those layout-only elements are invisible/non-interactive; only the execution readout and Solving cue are visible. This matches idle x/y/width/height and font size exactly at 1440x900, 390x844 and 320x568 without recorded coordinates. The actual shared header, reference panel, cube, Aa and history are not moved.

The active cube disappearance was the explicit `scrambleMode && t.phase !== 'idle'` concealment branch in SessionWorkspaceFrame. It has been removed for Execution/Guided. The reference cube stays mounted through idle, hold, memo, execution and completion. The reference column now follows Timer's existing 10% active opacity and 40% readiness opacity with the same transition; history is not additionally dimmed inside it.

All Training running clocks read the existing AppDataContext prefs.showLiveTimer. Compact Execution/Guided memo and large Guided execution reuse TimerReadout's existing masking rule: live elapsed time when enabled, exactly Solve while running when disabled. Recall/Trace clocks use that same preference and convention. Completed times, saved payloads and history are unaffected. No setting, default or persistence field was added.

Validation: typecheck, eight focused unit checks (shared readout/timing masking and Recall/Trace clocks), and ten targeted browser cases passed. Browser coverage includes exact idle/execution geometry at desktop and both phone sizes; active cube mount/visibility/geometry; enabling/disabling the real Settings toggle without reload, including changing it during active memo/execution with unchanged clock rectangles; final popup/history/time-per-target and unchanged persistence; phone touch flow; passive hover/delete; and the opening-Space/repeat/Space-close regressions. Evidence: test-results/training-live-final and guided-idle-anchor/active-cube screenshots. Desktop screenshots were visually inspected. Localhost remains http://127.0.0.1:5186 on training-ui. No full-app matrix, push, PR, merge or deployment.

## Timer phase feedback and shared Training reference popups

Guided now uses TimerPhaseCue itself for memo/execution, plus Timer's existing timer-execution-cue class on entering execution. The current Timer was run and inspected first: the Executing label uses the accent colour and a 160ms ease-out fade from opacity .35 / y4 to opacity 1 / y0; the readout uses the existing 450ms ease-out accent-to-ink animation and reduced-motion rule. Guided preserves its compact memo slot and exact idle execution rectangle. No new timing handlers or animation system was added.

ReferenceModal wraps the existing compact 440-design-pixel Sheet for all four Training help popups and Keybinds. Shell geometry, header, close control, typography, padding, border, background, radius and shadow are shared. Help is one short description and three/four labelled instructions, without row boxes/dividers/icons. All mode-specific help was rewritten against the actual start, recall/trace input, reveal, execution and result mechanics; idle descriptions are unchanged.

Keybinds now shows a plain key/action list for the current page and Training drill, followed by applicable popup shortcuts. Actual keyboard handlers were audited. Working N remains for Timer and execution-oriented Training setup. Misleading T/W example keycaps, the fixed A-X claim and vague save/close wording were removed; result labels reflect Guided OK/DNF versus Execution Solved/DNF. Settings now requests its own page list, so it shows common popup shortcuts rather than incorrectly presenting Timer bindings. Keyboard handlers and persistence were not changed.

Validation: typecheck and seven distinct targeted browser checks passed, covering direct Timer/Guided feedback parity, exact idle/execution anchor and compact memo geometry, shared live-timer masking during settings changes, completion Space ownership, and every mode's help/keybind popup at desktop and 320x568. Tests verify identical shells, no horizontal overflow, no desktop help scrolling, button/Escape/Space close, help opened with Space remaining open, and editable input retaining Space. Built-in browser visual inspection confirmed help and Keybinds; desktop and phone screenshots were reviewed. Evidence: test-results/training-reference-before, training-reference-run1, training-reference-popup-final and training-reference-regression. Local only on training-ui; localhost remains http://127.0.0.1:5186.
