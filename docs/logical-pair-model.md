# Logical Letter Pair identity

Implemented locally on `settings-ui`, 9–10 November 2026, after explicit approval of the additive integration. Production has not been queried or changed. Safety checkpoint: `2dc4b93` (`checkpoint settings work`).

## Permanent invariant

Changing lettering changes the logical tokens produced by physical cube targets. It never renames, copies, moves or deletes mnemonic data. Orientation and buffer changes affect mechanics only.

New mnemonic identity is the normalized tuple `(firstToken, secondToken, scope)`:

```json
["mnemonic-v1", "SH", "B", "shared"]
```

The JSON serialization is the map key and existing `kind=pair` sync record ID. Scope is `shared` (Default), `edges`, or `corners`. Each scope has an independent timestamp. UUIDs are metadata, not identity. New payloads have no physical sticker fields. Labels use the editor's uppercase/whitespace normalization. UI labels remain limited to three characters; storage accepts historical labels up to twelve code units.

`("S","HB")` and `("SH","B")` have distinct keys. Domain identity utilities own normalization, encoding, decoding, equality and memo references. The UI uses the existing boundary-safe `first|second` key; pipe is prohibited within labels. Timer memo references retain unambiguous AB shorthand for single-character pairs and use token arrays serialized as JSON for custom labels. Display formatting is separate from lookup identity.

## Additive persistence

`AppData.pairs` remains the legacy physical-record map. Optional `logicalPairs` and `logicalPairDeletions` hold new values and scope deletion timestamps. Only an actual edit creates a logical record. Merely opening the app, showing empty pairs, renaming lettering or changing orientation/buffers creates no mnemonic writes.

Readers use saved legacy `firstToken`/`secondToken`, never current sticker labels. The immutable physical sticker metadata identifies the legacy piece scope. Canonical logical values override legacy fallback independently per scope. Logical deletion metadata masks fallback instead of deleting its source. Hydration does not overwrite disagreeing legacy words with canonical ones or eagerly migrate legacy records.

If old devices reuse one physical key for different saved tokens, merge archives the displaced legacy payload under a stable legacy alias, preserving both records. Legacy entries with missing/invalid saved labels or unknown/mixed physical scope remain stored but are not assigned to a guessed pair. Effective-only old rows retain their established interpretation; their original Default/override intent cannot be inferred. Words already overwritten before this fix require an old backup to recover. Opaque historical long memo strings remain displayable but are not split into guessed tokens for word edits.

## Deletion, sync and backups

Deleting T pairs sets logical scope tombstones. These are mirrored into existing envelope `pair:<recordId>` tombstones and the existing RPC's deleted rows. They survive reload, import and stale-device hydration and suppress legacy fallback. Newer explicit word edits can recreate the same logical scope. Newer deletion evidence always wins over older imported metadata. Old physical tombstones do not match new logical record IDs.

Diffing, seeding, payload validation and hydration recognize the versioned namespace. Settings lettering changes generate settings mutations only. Different pairs/scopes cannot collide; concurrent edits to the same pair and scope use timestamp last-write-wins. Ownership, authorization headers, revision checks, batching and retries retain their existing implementation.

Version 1–3 workspace import/export accepts both formats, validates canonical key/payload agreement and preserves legacy keys, inactive logical values and logical deletions. No database table, SQL migration or production rewrite was needed. Tests use a completely mocked Supabase RPC client, not a remote project.

## Active navigation and consumers

Active labels come from current valid per-piece lettering. Default shows the union of valid Edge pair combinations and valid Corner pair combinations, not the Cartesian product of both alphabets. Edge-only T remains active; if T disappears from both alphabets its words become dormant. Restoring T or reusing historical SH naturally restores those words. T/F swaps change only target labels.

Unavailable overrides are disabled in the editor but preserved internally. Counts and visible rows exclude impossible cross-scope pairs. Existing design and normal single-character sizing remain.

Timer, reconstruction, Memo Recall, Training and Flashcards use atomic label tokens and boundary-safe lookup. Ordinary word edits write Default and preserve explicit overrides. Completed solve snapshots retain historical labels and used words. Custom-label answers retain explicit spaces/separators; ambiguous compact input is rejected rather than guessed. Timer tracing and cycle-break mechanics remain physical and unchanged.

Two-key jumping remains enabled when every active label is a single character. If any custom multi-character label is active, raw two-key jumping is disabled; users click labels/pairs and retain arrow navigation. There was no pair-search input to migrate. No buffered parser was added.

Optional legacy cleanup should wait until deployment confidence, verified backups and upgraded clients. It is not required for correctness. Old clients do not understand new logical records and must refresh/upgrade before continuing to edit after rollout.

See [integration review](logical-pair-integration-review.md) for the data-loss review, changed files and focused checks.
