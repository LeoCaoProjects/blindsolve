# Letter Pair persistence integrity

The UI model is Shared/default words plus optional Edge and Corner overrides. The old adapter flattened this to two physical pair records containing only effective words. Hydration treated the Edge record as Shared whenever the two records differed. Consequently saving Edge=Arrow over Shared=Apple reconstructed Shared=Arrow and Corner=Apple. With both overrides, the original Shared words were absent from the stored data.

## Local repair

`src/magic/utils/pairPersistence.ts` now owns both encoding and decoding for individual edits and bulk replacement. Newly edited records retain the existing physical keys, UUIDs, effective primary word and counters. Optional `vocabulary` metadata stores the explicit Shared/Default word, the piece-specific override (when present), and independent Shared/override timestamps. This is an additive JSON payload change, not a SQL schema migration. The current generic pair sync payload accepts this field without table/RPC/RLS changes.

The existing local-envelope, backup, account snapshot and record-sync paths preserve this metadata. Repository merging resolves Shared and the override independently, including an explicit timestamp for removing an override. A stale effective value therefore cannot become a Shared value or resurrect a removed override. No-op saves, hydration and scope browsing do not rewrite records. Bulk operations use the same encoder and retain unchanged record objects/timestamps.

## Existing data

Legacy records remain readable through the previous compatibility interpretation. Hydration does not tag, rewrite or "repair" them. Differing legacy Edge/Corner effective values cannot establish whether the original intent was a Shared word plus one override, two overrides, or legitimate separate vocabularies. Lost Shared words cannot be reconstructed reliably from this shape. Any future cleanup needs separate review; no production rows or existing local vocabulary were modified for this fix.

The isolated baseline reproduced Apple becoming a Corner value after Edge=Arrow was saved. The existing localhost guest session inspected during this task had zero saved words in all three scopes and its Clear-all control was disabled. No malformed records were found in that inspected local session; the test fixture demonstrates the ambiguous legacy pattern.

## Focused verification

Regression tests cover Shared only, Shared plus each override, both overrides, editing Shared and each override, removing overrides, clearing, explicit equal-valued overrides, ignored obsolete fields, owner-scoped local reload, backup round trips, cloud snapshot hydration, independent/concurrent scope changes, stale sync, tombstones, no-op saves, no hydration churn, and unchanged effective-word consumers. Browser tests save/reload after every required UI operation. Cloud behaviour is tested through local snapshot/merge fixtures; no live production account or Supabase rows were queried or modified.

## Single-word product cleanup

Each Default, Edge and Corner value now contains at most one active word. The existing JSON list shape is retained for compatibility, but readers and new writes use only its first value. The removed `alternates` field and legacy alias-table values are ignored; new records, backups and sync payloads do not require or emit that field. Conflict merging keeps the selected current word rather than accumulating discarded words. Shared and override timestamps still merge independently.

No production cleanup, table drop or migration is needed. Ordinary edits continue through the existing local-first record path. Clear all pairs removes only pair records, including records left by earlier letter schemes; store diffing queues pair tombstones while retaining solves, attempts and settings.
