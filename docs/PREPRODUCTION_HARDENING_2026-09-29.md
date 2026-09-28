# BlindSolve pre-production abuse hardening — 2026-09-29

This pass adds controls that do not depend on `blindsolve.com` or production OAuth URLs.

## Limits

- WCA OAuth start: 30 requests per IP fingerprint per rolling 10-minute fixed window. Enforced by the Edge Function through a private, service-role-only Postgres counter before redirecting to WCA.
- WCA OAuth callback: 15 requests per IP fingerprint per 10-minute window. Enforced independently before WCA token exchange or Supabase Admin Auth calls.
- Record sync: 120 accepted write calls per authenticated user per five-minute window. Existing limits remain 1,000 records and 5,000,000 serialized bytes per call, with per-record caps of 256 KiB settings, 32 KiB pair, 512 KiB solve, and 64 KiB attempt.
- Feedback: unchanged at 10 submissions per IP fingerprint per hour. Feedback remains Edge-only, origin checked, and field bounded.
- Feedback screenshots: 5 MiB per object, PNG/JPEG/GIF/WebP signatures only, private randomized server paths, with cleanup if the matching feedback insert fails.
- Solve videos: private, authenticated owner-only, existing-solve paths, 250 MiB per object, at most 100 objects and 2 GiB aggregate per account, WebM/MP4/QuickTime only. The upload UI is still dormant.
- Backup import: 25 MiB pre-read file limit. Parsed data allows at most 2,304 pairs, 100,000 solves, 100,000 attempts, 100 scheme-history entries, 100 timer sessions, 12-character sticker tokens, and 1,000-character general strings/mnemonics.
- Admin feedback list: explicit columns and the newest 100 rows per load. This bounds row transfer and signed-URL generation until cursor pagination is needed.

Operational rate tables have RLS enabled and no anonymous or authenticated client privileges. Edge counters are keyed by a service-key HMAC of the request IP, so raw addresses are not stored.

## Turnstile decision

Turnstile is deferred for launch. Anonymous feedback already has a server-only submission path, a low 10/IP/hour limit, strict payload and file controls, private storage, and cleanup. Adding a challenge now would impose visible friction on the low-volume feedback flow and add another production secret/configuration dependency. Reconsider Turnstile if monitoring shows distributed spam, if the feedback limit materially blocks shared networks, or before increasing anonymous quotas. Any later implementation must verify tokens server-side and must never expose the Turnstile secret.

## Residual infrastructure considerations

The database quota limits successful, well-formed sync writes. Supabase gateway/project protections remain the outer defense against high-rate malformed requests that fail before a transaction can commit its quota counter. Full initial sync snapshots are owner-only but still return the account's complete record set; cursor-based incremental snapshots and tombstone compaction should be added before accounts approach very large histories.
