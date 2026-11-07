# Execution Sprint completion cleanup

Local `training-ui` iteration. No push, PR, merge, deployment, backend or database changes.

## Current flow

Execution Sprint renders its rich completion inspector directly from `Training.tsx` while the finished attempt is in review. Close returns to the existing idle state via the existing session reset; it does not start timing another attempt. The only continuation button is Close, using Timer's shared button treatment.

The live completion includes recorded duration/result/date, restrained target/pair counts, scramble, edge/corner target pairs and available effective words. Reconstruction uses Timer's actual `SolveMemoView` / `MemoTrace`; no additional snapshots are copied or persisted. The existing result self-report and delete actions remain.

Historical time rows are passive divs. Their click handlers, button roles, pointer/hover affordances, selected-record state, history lookup/modal path, and optional historical-mode branches have been removed. Existing per-row delete controls remain separate and unchanged. The shared workspace frame now only handles layout/reference UI; it no longer owns any Execution details state. Timer's solve rows still open their saved-solve popup.

## Timestamp and storage audit

The timestamp predates the popup work. Checkpoint `dd11923` already writes `createdAt: new Date().toISOString()` in Execution/Training's existing attempt payload and sorts its history by that field. `src/lib/repository.ts` defines required `PracticeAttempt.createdAt`, validates it as an ISO timestamp, and uses it for generic attempt ordering. It is retained. The UI's later `createdAt` presentation mapping only exposes that existing field; it does not add persistence.

No extra reconstruction persistence remains. No target sequence, mnemonic snapshot, popup object, storage key, database/table/column/RPC or sync payload was added. The earlier RAM-only snapshot layer was already removed; this pass removes the remaining historical-detail UI plumbing. Repository, generic persistence, app store and Supabase files remain unchanged.

## Date parity

Both popups render the very same date element in `SolveSummary` and use `formatSolveDate`. The old Frame-owned modal path lacked an explicit font-sans wrapper, unlike Timer's route content. `SolveDetailsShell` now explicitly carries `font-sans`, and the completion is owned by the Training page. The browser comparison verifies identical computed font family, size, weight, colour, line height, letter spacing and relative x/y placement against Timer. Timer's date format and styling are unchanged.

## Targeted checks

TypeScript and four browser cases passed:

1. Flashcards: instant first cube, subsequent rotations, instant re-entry.
2. Execution: finished data/target sequence/counts, Close to idle, passive rows before/after reload, no hover/pointer/status icon, no empty history modal; exact Timer reconstruction classes, shell/button/date parity; unchanged stored attempt keys.
3. 320x568 phone: result control stays within header, Close/delete visible, no horizontal overflow.
4. Existing Execution time/DNF persistence across reload.

Evidence: `test-results/execution-passive-history`; screenshots in `test-results/execution-details/`. Desktop and phone screenshots inspected. No full-app matrix.

## Time-per-target and hover polish

Completion metadata also derives Time per target as `completed duration / target count`, formatted with the existing centisecond `formatTime` convention. Invalid/missing/zero target counts or invalid totals omit it. No field is persisted. Execution's passive time rows reuse Timer's subtle hover background while retaining `cursor: default` and no click handler; the separate delete button keeps its existing interaction.

Targeted validation: 11 derived-stat unit assertions, typecheck, completion/stat/payload/hover/passive-click/delete checks, and a 320x568 popup check passed. The inherited date-position assertion rounds coordinates to 0.001px to avoid float serialization noise.
