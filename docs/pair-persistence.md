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
