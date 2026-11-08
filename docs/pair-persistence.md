# Letter Pair persistence integrity

The UI model is Shared/default words plus optional Edge and Corner overrides. The old adapter flattened this to two physical pair records containing only effective words. Hydration treated the Edge record as Shared whenever the two records differed. Consequently saving Edge=Arrow over Shared=Apple reconstructed Shared=Arrow and Corner=Apple. With both overrides, the original Shared words were absent from the stored data.

## Local repair

`src/magic/utils/pairPersistence.ts` now owns both encoding and decoding for individual edits and bulk replacement. Newly edited records retain the existing physical keys, UUIDs, effective primary word. Optional `vocabulary` metadata stores the explicit Shared/Default word, the piece-specific override (when present), and independent Shared/override timestamps. This is an additive JSON payload change, not a SQL schema migration. The current generic pair sync payload accepts this field without table/RPC/RLS changes.

The existing local-envelope, backup, account snapshot and record-sync paths preserve this metadata. Repository merging resolves Shared and the override independently, including an explicit timestamp for removing an override. A stale effective value therefore cannot become a Shared value or resurrect a removed override. No-op saves, hydration and scope browsing do not rewrite records. Bulk operations use the same encoder and retain unchanged record objects/timestamps.

## Existing data

Legacy records remain readable through the previous compatibility interpretation. Hydration does not tag, rewrite or "repair" them. Differing legacy Edge/Corner effective values cannot establish whether the original intent was a Shared word plus one override, two overrides, or legitimate separate vocabularies. Lost Shared words cannot be reconstructed reliably from this shape. Any future cleanup needs separate review; no production rows or existing local vocabulary were modified for this fix.

The isolated baseline reproduced Apple becoming a Corner value after Edge=Arrow was saved. During the original persistence repair, the inspected localhost guest session had zero saved words in all three scopes. No malformed records were found in that inspected local session; the test fixture demonstrates the ambiguous legacy pattern.

## Focused verification

Regression tests cover Shared only, Shared plus each override, both overrides, editing Shared and each override, removing overrides, clearing, explicit equal-valued overrides, ignored obsolete fields, owner-scoped local reload, backup round trips, cloud snapshot hydration, independent/concurrent scope changes, stale sync, tombstones, no-op saves, no hydration churn, and unchanged effective-word consumers. Browser tests save/reload after every required UI operation. Cloud behaviour is tested through local snapshot/merge fixtures; no live production account or Supabase rows were queried or modified.

## Single-word product cleanup

Each Default, Edge and Corner value now contains at most one active word. The existing JSON list shape is retained for compatibility, but readers and new writes use only its first value. The removed `alternates` field and legacy alias-table values are ignored; new records, backups and sync payloads do not require or emit that field. Conflict merging keeps the selected current word rather than accumulating discarded words. Shared and override timestamps still merge independently.

Ordinary edits continue through the existing local-first record path. The contextual Delete {letter} pairs action deletes actual persisted records whose firstToken exactly matches the captured selected token. It includes Default and both overrides, including matching records left by older schemes. Store diffing queues record tombstones while retaining other letters, solves, attempts and settings. Stale sync cannot resurrect those records. Settings retains its separate, explicitly global reset/import functionality.

## Pair usage cleanup

The obsolete `encounters` and `forgotten` fields were part of the pair domain type, repository schema/merge/legacy-cloud reader, pair writers and fixtures. Both Flashcards implementations incremented them; the legacy Timer reconstruction writer also incremented encounters and retimestamped pairs merely used in a solve. AppDataContext summed encounters for the pair editor’s usage line. These dependencies have been removed. Flashcard/Training attempts and Timer solves remain independent and preserved. Reading/practising an existing word no longer changes its pair record.

Hydration strips historical counter fields without writeback; new pair records and outgoing JSON omit them. Old local/backups/sync JSON may still contain ignored fields. Historical SQL migration 202609250002_bld_training.sql also defines integer columns `public.letter_pairs.encounters` and `forgotten`. They remain unused; no migration or production operation was performed. Removing them physically would require a separately reviewed DROP COLUMN migration (including associated constraints); removing historical JSON would require a separate revision-aware rewrite of pair payloads in bld_sync_records and any legacy backups. Two SQL integer values are eight bytes before row overhead; JSON also carries field names and digits. This is a small per-record saving, not a claim of substantial database reduction.


## Ordinary word authoring is Default-only

`writeDefaultWords(data, logicalPairWords)` is the shared semantic operation for normal word authoring. It merges only `shared` into each decoded entry and delegates to the existing `writePairEntries`, preserving explicit Edge/Corner overrides, identities, timestamps and record-level sync. AppDataContext exposes `setDefaultWord` / `setDefaultWords`; ordinary callers receive no persistence-scope parameter. The old piece-directed `addWord` / `applyTimerDbUpdates` and legacy physical `upsertPair` entry points were removed.

| User action | Mutation path | Persisted scope |
| --- | --- | --- |
| Timer missing word, suggestion or changed-word review | useReconstruction.finish → defaultWords → useTimerSession → setDefaultWords → writeDefaultWords | Default |
| Memo Recall typed/suggested word, explicit Save | RecallReview → setDefaultWord → writeDefaultWords | Default |
| Flashcards inline edit | useFlashcards.editPrimary → setDefaultWord → writeDefaultWords | Default |
| Legacy Timer/saved-solve reconstruction | Reconstruction.save → writeDefaultWords | Default |
| Legacy pair/Flashcards editor | PairEditor → writeDefaultWords | Default |
| Unified Letter Pairs editor | savePair → writePairEntries | The explicitly labelled Default, Edge or Corner fields |
| Structured vocabulary import / backup / synchronization | Existing replace/merge/schema operations | Preserve explicitly supplied stored scope |

Current saved-solve inspectors and Execution Sprint, Guided Solve and Trace Sprint reviews are read-only mnemonic consumers, not additional word-writing surfaces. Suggestion components themselves only return a selected value to their owning workflow.

The previous bug was concrete: Timer reconstruction used `piece:pair` keys for both effective lookup and mutation. Its adapter parsed that prefix and wrote the corresponding override. Memo Recall passed `item.piece` directly to `addWord`; Flashcards reused the effective lookup's `source` to choose the edit destination. Solving context had become an implicit persistence instruction.

Effective lookup remains piece-specific (explicit override, then Default). The flat Timer database key now means Default only; explicit piece-prefixed keys retain their read values. Reconstruction keeps the words actually used in each piece context separate from Default persistence. It compares replacement decisions with Default, not the effective override; if the same pair is edited in both contexts, the latest explicit edit supplies the single Default change. Copy states that edits save to Default; existing overrides remain untouched.

Historical accidental and deliberate overrides cannot be distinguished safely: the records retain scope/value/timestamps but no authoring-origin or user-intent marker. No historical values were guessed, flattened, migrated or rewritten.

## Pair shortcut ownership

Previously the letter handler lived on the grid's bubbling `onKeyDown`. Navigation/link focus was outside that grid, and grid autofocus deliberately yielded to vocabulary controls. Thus route/view changes could leave the shortcut without its event source.

The letter listener now belongs to the active `/pairs` route, is installed in a layout effect before paint, and resets with the router history entry. Grid arrow/Enter handling remains local. A completed pair has an explicit focus request, so navigation-focus protection does not swallow an intentional jump. Token-list identity is stable by token contents, preventing unrelated scheme-object refreshes from discarding a partial sequence. The existing 900ms timeout remains; input/textarea/select/contenteditable, modal activity, window blur, explicit letter selection and lifecycle changes safely reset or suspend the sequence. Listeners/timers are cleaned up on exit.
