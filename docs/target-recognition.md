# Target Recognition local checkpoint

Started from the clean `release-audit` branch at
`421dc11a5cfdea24f3373f2b265453adbc8d4f60` (`finish stage one guards`).
Development uses `target-recognition` in the permanent `.codex-worktree`.

## Mechanics and presentation

The existing random-state scramble hook and `challengeFromScramble` produce the
same structured raw reconstruction used by Training. Recognition follows the
configured buffer, then each raw physical target location, in the configured
memo order and shared scope. Each observation is checked against `homeSticker`.
Synthetic cycle-break entries are skipped; their chosen location starts the next
recognition chain. M2 execution swaps never rewrite recognition answers. No parity
question is added, and logical tokens are never concatenated to identify stickers.

The Settings SchemeCube renders the unchanged scrambled state. All stickers of the
inspected physical piece remain bright; the source sticker has the Settings accent ring, its partners have ink rings, and centres dim with the rest of the cube.
`bestRotation` makes its two or three colours visible in the configured view.
Camera changes use the same 260ms ease-out as Settings, taking the nearest equivalent turn without an input lock. Labels and the
scrambled cube are absent before the shared hold-to-start gesture completes.

Single-character scopes submit one character immediately. Schemes containing
multi-character labels use a focusable input with Enter submission and Backspace
editing, including on mobile. Modifier/composition/repeat guards apply. Answers
advance without correctness feedback. The final answer ends timing and saves once.
Route/mode activation and relevant setup changes abandon incomplete recognition
attempts and clear their answers. Changing setup also cancels a pending hold.

ReviewPanel, ReviewHeader, SolveSummary, SolveDetailsActions, CompactTrainingTimer,
TrainingHistory/VirtualHistory, shared navigation/scope, and the existing store
update/deletion pipeline are reused. Results show time, target accuracy, time per
target, and ordered expected/entered tokens. Only completed attempts persist.

PracticeAttempt supports the `recognition` mode. Only the standard compact summary
is saved: id, kind, mode, createdAt, durationMs, targets, correct and accuracy.
Expected/entered tokens exist only in the current session for the immediate result.
Recognition now uses TraceReview directly, including PairDiff and automatic DNF.
History rows are numbered, non-clickable, and use the standard hover-delete control.
Obsolete recognition answer payloads are ignored by the data parser. No database
migration, polling, or hydration writeback is involved.

The active view shows a short instruction and a counter. Single-character entry
has no visible field; multi-character entry shows only the typed token without
an input box. Tapping the instruction focuses the mobile keyboard.

Changed areas: recognition derivation and tests; Training session/provider, mode
metadata and shortcuts; cube observation emphasis; recognition workspace/review;
Training history, dock, idle preparation state and page wiring; hold reset key;
workspace reference-cube visibility; repository payload validation.

## Targeted validation

35 unit tests passed:

```powershell
npx vitest run src/magic/hooks/useRecognitionSession.test.tsx src/magic/hooks/useExecScramble.test.tsx src/magic/utils/recognition.test.ts src/magic/utils/bld.test.ts src/magic/utils/challengeTargets.test.ts src/magic/components/training/TrainingClock.test.tsx src/magic/hooks/useLogicalWordConsumers.test.tsx
```

6 focused browser tests passed:

```powershell
npx playwright test e2e/target-recognition.spec.ts e2e/stage1-guards.spec.ts e2e/training-polish.spec.ts --grep 'single-key|mobile multi|held Timer|Training composing|popup owns'
```

The two recognition browser tests were rerun after final historical-review and
error-handling refinements. Typecheck: `npx tsc -b --pretty false`.
Desktop and 390px mobile screenshots were inspected; the built-in browser was
also used to inspect the active exercise. Real software-keyboard behavior still
deserves personal device review.

An earlier run of the whole four-test `stage1-guards.spec.ts` also passed the route
check, but its unrelated unconfigured-sign-in test failed: this localhost server
has configured sign-in, so the expected "Sign-in is not configured" alert did not
appear. Auth was not changed. No full test matrix, build, release audit, or lint
suite was run.

Baseline discrepancy: although the request describes Trace Sprint as cube-free,
the verified starting implementation already includes virtual cube views in
TraceSprintWorkspace. Those existing views were left unchanged, consistent with
the instruction to preserve approved modes.

## Local review

Run the unchanged command from the permanent worktree: `npm run dev`.
URL: http://127.0.0.1:5173/training

- Check Target Recognition's placement beside the four existing modes, and compare
  their layout and interaction with the baseline.
- Hold/release Space or touch to start. Confirm no useful scrambled state or
  answers appear beforehand, then check the outlined source and all partner colours.
- Infer answers from colours/orientation. Mix correct and wrong entries; check
  immediate target changes and no accuracy feedback before completion.
- Check final time, accuracy, time per target and ordered answer review; then
  check numbered DNF history and delete an attempt. History does not reopen reviews.
- Try Edges, Corners and Both, a rotated orientation, and a custom `SH` label with
  Enter. Check mobile keyboard entry and return from another route mid-attempt.

Local work only. Nothing was pushed, merged, deployed, or applied to production.
No production Supabase/SQL/Cloudflare settings were modified. Release audit stops
at the existing Stage 1 checkpoint; no next stage was started.

## Refinement validation

The Settings cube / minimal input / compact persistence iteration passed 19
focused unit tests across useRecognitionSession, SchemeCube, recognition and
challengeTargets. The desktop and mobile recognition browser tests passed.
Typecheck passed. Older validation above records the initial implementation.

## Typing-strip iteration

Recognition now shows neutral submitted tokens sliding to the left of a fixed caret,
with a quiet inline progress count and keyboard hint. The current multi-character
token appears to its right. Backspace edits that token first; with an empty token it
removes the preceding atomic answer and restores that cube observation. Timing
continues, and only the corrected final answers determine the saved summary.
The source sticker alone has a neutral white focus outline and small centre marker;
partner colours remain bright with no rings. The history readout now says `mean`.
No answer data was added to persistence.

Validation: 16 focused unit tests passed in useRecognitionSession, SchemeCube and
recognition; the 2 desktop/mobile recognition browser tests passed, including
Backspace restoring the physical source and multi-character token editing.
`npx tsc -b --pretty false` passed. Desktop and mobile screenshots were inspected.

## Prompt motion and perimeter aura

The initial prompt now slides left and fades on first input. Faint empty positions
arrive from the right and keep advancing as answers are entered, without exposing
expected letters. The divider and permanent keyboard hint were removed; progress
sits quietly under the caret. The selected sticker's centre dot is gone, replaced
by a gentle pulsing perimeter glow around a crisp neutral outline. Reduced motion
disables the pulse and translational typing effects.

Validation: 11 focused unit tests in SchemeCube/useRecognitionSession, both
desktop/mobile browser tests, and typecheck passed. No persistence changes.

## Target clarity, result focus and mode order

The camera now favours the source colour while keeping every partner face visible.
The source stays fully bright with a thicker contrasting outline and stronger
perimeter glow; partner stickers use softer colour emphasis and unrelated stickers
dim further. Camera tests cover every physical sticker in standard/custom views.
The shared result action row explicitly focuses Close, so Enter dismisses the
result and preserves the saved attempt. Delete remains available by deliberate
selection. The mode order is Execution Sprint, Guided Solve, Target Recognition,
Trace Sprint, Memo Recall.

Validation: 16 focused unit tests passed; 4 selected browser tests passed across
recognition desktop/mobile and Execution/Guided popup keyboard behavior. Both
recognition tests were rerun after the final camera update. Typecheck passed.

## Neutral result focus and reference-sheet dismissal

Result dialogs now focus their invisible container rather than a button. Enter and
Space use the shared dismissal keybinds; explicit keyboard navigation still reaches
controls normally. Closing result/help/keybind sheets returns keyboard ownership to
the workspace, so the next held Space starts normally. ReferenceModal uses this
across all Training modes and the Timer/Flashcards shortcut sheets.

Validation: 14 focused unit tests passed, including every physical edge/corner in
all 24 cube orientations. Both/all three required colours remain visible, so cube
presentation was left unchanged. Twelve browser checks passed: all five Training
help sheets, Timer/Flashcards reference sheets, desktop/mobile recognition results,
Execution/Guided popup keyboard guards, and Timer popup editable controls.
Typecheck passed.

## Trace accuracy rows and stable recognition scope

Trace Sprint history now uses the same stored correct/total target formatter as
Recognition and Recall. Existing DNF behavior and summary-only persistence remain.
Recognition's preparation message has a reserved line below the description,
so loading/ready transitions cannot recenter the idle timer. Recognition's idle
position animation is disabled; other Training modes retain their existing motion.

Three focused browser tests passed: Trace history `13/20 targets`, plus per-frame
timer/description anchor checks across Both/Edges/Corners on desktop and mobile.
Typecheck passed.
