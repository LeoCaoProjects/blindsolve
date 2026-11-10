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
