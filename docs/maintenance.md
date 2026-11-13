# Small maintenance checks

Once a month, and before promoting BlindSolve to substantially more users:

1. Run `supabase/diagnostics/capacity.sql` in the authorized Supabase SQL editor. It is read-only and reports database size, active records, hard tombstones, older soft-deletes and major relation/index sizes. Save dated aggregate output outside the repository; do not export user payloads.
2. Check actual monthly egress/database usage in the Supabase dashboard. Do not infer billing from uncompressed JSON or Cloudflare HTTP counts. Revisit browser persistence before promising thousands of records, and retention capacity as database size approaches 350–400 MB on Free.
3. Keep a current manual backup/export and known restore procedure. Never clear local browser data to resolve a quota warning. No tombstone expiry or production maintenance command is part of this diagnostic.

`n_dead_tup` estimates obsolete PostgreSQL row versions, not intentional sync tombstones. Relation allocation includes pages, indexes and reusable space; a large size-to-row ratio alone is not a reason to VACUUM FULL or drop indexes.

## Caching

The production build adds exact `_headers` rules for existing content-hashed assets, with `public, max-age=31536000, immutable`. HTML revalidates; 404 documents use `no-store`. There is no immutable wildcard. The build fails if it exceeds Pages' 100-rule limit rather than emitting an incomplete policy. `npm run test:seo` checks generated rules.

After deployment, verify representative JS/CSS/font URLs extracted from the new HTML/CSS, plus `/`, `/training` and a nonexistent asset. Confirm status, Content-Type and Cache-Control; errors/HTML must never be immutable. Existing zone cache rules can override response headers and require separate verification.

## Storage recovery

A failed localStorage replacement leaves the previous document intact. New work remains in memory, with a persistent export/retry warning and tab-close prompt. Outbox dispatch waits for a successful local commit. Unsaved owner copies stay separate for this tab's lifetime. Switch back to that account to retry or export. A rescue export contains the in-tab workspace and known deletion markers, without credentials or queued requests. Restore into a separate local workspace. Unreadable originals are retained until successful read and reconciliation. Export volatile data before closing.

## Database regression tests

The pgTAP tests target the current `get_bld_sync_snapshot` / `apply_bld_sync_changes` contract. Run only in an isolated local Supabase database with Docker or the dedicated CI job. **Never pass `--remote`, use the linked production database, or supply production credentials.** Fixtures create users and exercise writes inside a rolled-back transaction.

CI generates a fresh local configuration in a temporary directory, copies only migrations/tests and starts the isolated stack. It needs no Supabase secrets. Frontend tests separately cover hydration, account isolation, no-op writes, deletion reconciliation and controlled storage failures.
