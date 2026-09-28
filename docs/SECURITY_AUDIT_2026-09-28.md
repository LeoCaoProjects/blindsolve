# BlindSolve pre-production security audit — 2026-09-28

Scope: `dev` branch, dedicated Supabase project `dvujcwvavwcflymksmuz`, the built Vite client, deployed Edge Functions, live database/RLS/grants, private Storage buckets, OAuth entry points, local-first sync, feedback/admin flows, dependency and GitHub configuration. The browser and publishable key were treated as hostile. Production Cloudflare configuration and `blindsolve.com` were deliberately not changed.

## 1. Executive summary

The audit found two exploitable high-severity authorization/abuse issues and four medium/low hardening issues. The high findings were remediated and verified live:

- authenticated users could bypass revision-controlled sync by writing directly to sync tables;
- anonymous callers could bypass the app and submit unlimited feedback rows and 5 MB screenshot objects.

The live database is now migration-current through `202609280008`; both Edge Functions are active; cross-user and admin isolation tests passed; direct bypasses are closed. There are no known critical findings. Production launch is **not yet approved** because Auth still points at localhost, the repository headers have not yet been observed on a real Cloudflare deployment, and production abuse controls for WCA OAuth/sync still need an infrastructure decision.

## 2. Architecture/security boundaries

- Browser: untrusted; contains only the Supabase URL and publishable/anon key.
- Supabase Auth: issues user JWTs; Google is native Supabase OAuth; WCA is a public Edge Function that exchanges WCA OAuth server-side and produces a one-time Supabase magic-link hash.
- Postgres: RLS is enabled on all application tables. User identity comes from `auth.uid()`, never request JSON.
- Sync: local storage is the immediate source for UI state; authenticated RPCs provide cloud snapshots and revision-controlled record writes.
- Feedback: submissions now cross a public Edge boundary; inbox reads/updates/deletes require database-backed admin membership.
- Storage: both buckets are private. Feedback writes are service-role-only behind the submission function; solve-video writes are owner/solve scoped.
- Service role: used only inside deployed Edge Functions. It is absent from browser code and local `.env.local`.

## 3. Critical findings

None verified.

## 4. High findings

### F-01 — Direct sync writes bypassed revision enforcement (fixed)

- Severity/component: High — `bld_sync_records`, `bld_sync_state`, legacy `bld_workspaces`.
- Evidence: migration `202609280004` granted authenticated `INSERT, UPDATE`; live grants confirmed this before hardening. An authenticated caller could use PostgREST instead of `apply_bld_sync_changes`.
- Exploit: forge its own revision/state or replace records outside optimistic concurrency, causing replay/conflict corruption and inexpensive database amplification. RLS still prevented attacking another user.
- Current exploitability: no. Migration `202609280005` revoked direct writes and legacy save execution; the narrowly scoped RPC is `SECURITY DEFINER`, has `search_path=''`, fixes `user_id=auth.uid()`, validates batches/IDs/payload size/timestamps/duplicates, and serializes by revision.
- Verification: live privilege checks show authenticated insert/update false and RPC execute true; a simulated authenticated direct insert was denied; valid RPC write succeeded inside a rolled-back transaction; stale, duplicate, and invalid-ID writes were rejected.

### F-02 — Anonymous feedback and screenshot storage exhaustion (fixed)

- Severity/component: High — public feedback table insert and `feedback-screenshots` Storage insert.
- Evidence: anonymous roles had direct insert permission; the original Storage policy accepted any object in the bucket with no rate limit or ownership relationship.
- Exploit: scripts could create unlimited rows and up to 5 MB objects without using the UI, exhausting Free-tier database/storage and leaving orphaned objects.
- Current exploitability: the direct route is closed. Migrations `202609280006`/`007` revoke public table/storage writes. `submit-feedback` enforces allowed origin, 10 submissions/IP/hour, strict lengths, category/email/context validation, 5 MB size, PNG/JPEG/GIF/WebP signature-derived MIME, server-derived authenticated identity, private randomized paths, and upload cleanup if row insertion fails.
- Verification: direct anonymous feedback insert returned 401; direct screenshot upload failed; rate test returned true for attempts 1–10 and false for 11; one temporary submission returned 201 and its row was immediately removed.

## 5. Medium findings

### F-03 — Production Auth URL is still localhost (open launch blocker)

- Severity/component: Medium — Supabase Auth configuration.
- Evidence: live `site_url=http://localhost:5173`; allow-list contains only localhost and `127.0.0.1`. Google is enabled; CAPTCHA is disabled.
- Exploit/current state: not a current confidentiality bypass, but production callbacks will fail or redirect incorrectly if deployed as-is. This is intentionally still local because the task forbids connecting `blindsolve.com`.
- Remediation: immediately before production, set exact HTTPS Site URL and explicit callback allow-list; retain localhost only if development login is still required; re-test Google and WCA end-to-end.

### F-04 — Missing repository-managed browser security headers (fixed in code; deployment verification pending)

- Severity/component: Medium — Cloudflare Pages response headers.
- Evidence: no `_headers`/equivalent existed. The app therefore had no repo-defined CSP, clickjacking, MIME-sniffing, referrer, permissions, COOP, or HSTS policy.
- Exploit: another injection bug would have had fewer containment layers; the app could be framed.
- Remediation: `public/_headers` now supplies a restrictive CSP, `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `nosniff`, referrer/permissions policies, COOP, and HSTS. It is present in `dist/_headers`. Verify headers on the eventual Cloudflare URL before launch.

### F-05 — Solve-video policy was path-only and allowed 1 GB/object (fixed)

- Severity/component: Medium — private `solve-videos` bucket.
- Evidence: the original policy checked only path segment one equals `auth.uid()`; no existing owned solve was required; bucket limit was 1 GiB.
- Exploit: any authenticated account could upload arbitrarily named large objects in its prefix and rapidly consume the project quota. Cross-user reads were not available.
- Remediation: migration `202609280008` limits objects to 250 MB and requires Storage owner, exact `<user>/<solve>/<filename>` structure, and an existing solve owned by that user for all operations. The bucket remains private.

### F-06 — Remaining authenticated/API abuse limits (open)

- Severity/component: Medium — WCA OAuth start/callback and sync RPC.
- Evidence: WCA start is a public redirect endpoint; sync accepts up to 1,000 records/5 MB per successful call and has no app-specific calls-per-window limit. Supabase platform protections exist, but no BlindSolve-specific limit was observed.
- Exploit: distributed or multi-account traffic can consume Edge/WCA/database/network quotas. Record size and revision checks contain individual requests, but not sustained valid traffic.
- Remediation before launch: use infrastructure-level limits that cannot roll back with a failed DB transaction. Suggested starting points: WCA start 30/IP/10 min, callback 15/IP/10 min; sync 120/user/5 min with a modest burst. Return 429 and never clear local pending data. Monitor before tightening. Do not proxy ordinary sync through an Edge Function solely for rate limiting unless Supabase/Cloudflare controls cannot enforce it.

### F-07 — GitHub Actions supply-chain policy is permissive (open)

- Severity/component: Medium — GitHub Actions.
- Evidence: repository is private; Actions are enabled with `allowed_actions=all`, `sha_pinning_required=false`; workflow uses official actions by mutable major tags. Branch protection is unavailable for this private repository on the current GitHub plan.
- Exploit: compromise/mutation of an allowed action tag or an accidental workflow addition could execute with repository workflow privileges. Current workflow explicitly has `contents: read` and no deployment/secrets step, which reduces impact.
- Remediation: restrict allowed actions to GitHub/verified actions and pin actions to reviewed commit SHAs. Protect `main` when the plan supports it, or retain a documented manual merge checklist.

## 6. Low findings

### F-08 — WCA errors were reflected and non-GET methods were accepted (fixed)

- Evidence/exploit: caught provider/Supabase/configuration messages were placed into `auth_error`; any method started the flow. This could expose operational detail and increased endpoint surface, but no token was reflected.
- Remediation: deployed version 6 accepts GET only, emits generic browser errors, logs only a fixed error class, and sends `no-store`. POST now returns 405.

### F-09 — Backup import had no pre-read byte limit (fixed)

- Evidence/exploit: `await file.text()` ran before validation, so a deliberately huge local file could cause browser memory/CPU pressure. It could not compromise the cloud without later schema validation and user confirmation.
- Remediation: reject backup files over 25 MB before reading. Zod validation, 48-sticker invariants, UUIDs, enum/numeric/string limits, duplicate pair detection, and merge confirmation remain in place.

### F-10 — Third-party font request and inline-style CSP allowance (accepted)

- Evidence: CSS imports Google Fonts; CSP therefore permits `fonts.googleapis.com`, `fonts.gstatic.com`, and inline styles required by the current React/motion UI.
- Impact: Google receives normal font-request metadata; the CSP is less strict for CSS than a nonce/hash-only policy. Scripts remain self-only and no HTML injection sink was found.
- Remediation: safe to defer; self-host the remaining fonts later and investigate hashed/nonced style delivery if practical.

## 7. Informational findings

- `localStorage` contains user workspace data and Supabase's browser session. Any future same-origin XSS could read it; no `dangerouslySetInnerHTML`, `innerHTML`, `eval`, or `new Function` use was found.
- WCA and Google intentionally converge by email. WCA's v0 API exposes the authenticated account email but no explicit `email_verified` field. This is a documented trust dependency of the chosen linking design.
- The older CubeIQ FastAPI directory is not used by the BlindSolve frontend/deployment. If deployed later, it needs its own rate limits, response-error sanitization, field selections (it currently uses `select=*`), and an atomic timeline replacement RPC.
- V1 read APIs and workspace snapshot RPC remain only for migration fallback. Write access is disabled.

## 8. Rate-limiting/abuse analysis

| Surface | Threat/current protection | Recommended enforcement |
|---|---|---|
| Supabase Auth/Google | automated signup/token attempts; Supabase Auth IP token buckets are active, CAPTCHA off | Enable Turnstile/CAPTCHA where compatible; retain Supabase rate limits; monitor 429s |
| WCA start | redirect/Edge invocation amplification; state cookie but no rate limit | Cloudflare/Supabase gateway IP limit, ~30/10 min |
| WCA callback | WCA/API/Auth egress amplification; valid state/code required | IP limit ~15/10 min; 429/no retry loop |
| Feedback | anonymous row/storage spam | Completed: Edge IP HMAC bucket, 10/hour, hard body/file limits |
| Feedback screenshot | storage/MIME abuse | Completed: only Edge service role, 5 MB, image signatures, private random path |
| Solve video | storage exhaustion | Completed: 250 MB/object, owner+solve path; add per-user storage quota before enabling UI uploads |
| Sync write | database/network/storage amplification | 1,000 records/5 MB, per-record limits and revision lock exist; add 120/user/5 min infra limit |
| Sync snapshot | large response/egress | authenticated owner-only; cache once/session; add pagination before very large histories |
| Admin inbox | expensive full-list/signed URL generation | admin-only; add pagination before substantial feedback volume |

## 9. Secrets audit

- `.env.local` is ignored by `.gitignore` and untracked.
- Current-tree and all-commit pattern scans found no access token, DB password, JWT-shaped service role, private key, or real WCA secret. Hits for `WCA_CLIENT_SECRET=` were documented placeholders only.
- `dist` contains zero source maps and no match for local access token, DB password, or WCA secret. The service-role key is not present in local frontend environment.
- The Supabase URL and publishable/anon key are expected public browser values.
- Edge secret listing exposed names/digests only; required APP/WCA/Supabase managed secrets exist.

## 10. OAuth audit

- Google: enabled through Supabase; nonce checking is not disabled; refresh-token rotation is enabled; JWT lifetime is 3,600 seconds. Production redirect configuration remains pending.
- WCA: authorization-code flow; 122-bit+ random UUID state; state stored in 10-minute `HttpOnly; Secure; SameSite=Lax` cookie and compared exactly; fixed HTTPS callback derived from `SUPABASE_URL`; fixed app origin from `APP_URL`; one-time hash returned in URL fragment; client clears fragment after verification.
- Live checks: WCA start 302s to the official host; exact callback is `/functions/v1/wca-oauth/callback`; scope is `public email`; state and cookie flags exist; caller-supplied redirect override was ignored; POST returns 405.
- Scope: WCA requires `public` when a non-empty scope is used; `email` is necessary for the intentional Supabase email identity bridge. No wider WCA scope is requested.
- Remaining trust: WCA v0 is explicitly described by WCA as unsupported/for experienced developers. Monitor changes and contact WCA Software/Data Protection teams before public launch.

## 11. RLS/grants audit

- All 18 public application tables have RLS enabled.
- Owner tables compare row owner IDs to `auth.uid()` directly or through locked-down ownership helpers.
- Anonymous public-table access is now absent. Feedback submission is Edge-only.
- `feedback_admins` has no anon/authenticated table privileges.
- Random authenticated UUID simulation saw zero sync state/records, feedback rows, V1 pairs, or V1 solves.
- Table owners and service role bypass RLS by design; privileged keys remain server-only.

## 12. RPC/database audit

- All security-definer application RPCs use `search_path=''` (Supabase's managed RLS event helper uses `pg_catalog`).
- `apply_bld_sync_changes` is executable only by authenticated and binds all writes to `auth.uid()`.
- `consume_feedback_submission_slot` is executable only by service role.
- `is_feedback_admin` returns a boolean only and is executable only by authenticated.
- Legacy `save_bld_workspace` is no longer executable by authenticated.
- No dynamic SQL is used by application RPCs. IDs are typed or regex/length validated. Duplicate batches and future timestamps are rejected.

## 13. Storage/upload audit

- Both buckets are private; no public read policy exists.
- Feedback screenshots: public direct upload removed; admin read/delete only; function derives MIME from file signature, uses random server path, and removes the file after a failed row insert.
- Solve videos: authenticated owner only, exact owned-solve path, 250 MB, WebM/MP4/QuickTime MIME allow-list.
- Residual limitation: magic-byte checks are not a full image decoder/antivirus scanner. Private delivery and forced image MIME substantially reduce active-content risk.

## 14. Sync-security audit

- Local writes are immediate; cloud writes are debounced/coalesced and one active sync is enforced in the application.
- Offline changes stay in per-account local envelopes and pending-record maps; failures use bounded backoff and do not erase local data.
- Server revisions serialize accepted batches. Stale revisions return SQLSTATE `40001`, triggering merge/retry behavior.
- Direct write bypass is removed. Batch maximum is 1,000 records/5 MB, with settings 256 KiB, pair 32 KiB, attempt 64 KiB, and solve 512 KiB limits.
- Replay of an already-accepted expected revision fails. Concurrent writes for one user lock the state row.
- Remaining scale concern: snapshots return all of a user's sync records and tombstones. Pagination/compaction should be introduced before histories approach tens of thousands of records.

## 15. Admin-system audit

- Admin status is based only on `feedback_admins`, not email or mutable browser metadata.
- Users cannot select or insert admin memberships; a random authenticated identity returned `is_feedback_admin=false` and saw no feedback rows.
- Inbox select/update/delete and screenshot signed URLs remain protected by the admin function/RLS.
- Admin bootstrap must continue through trusted SQL with the exact Auth UUID; never expose an admin-management client API without an audited server boundary.

## 16. Frontend/XSS audit

- No raw HTML rendering, DOM `innerHTML`, eval, dynamic function construction, or unsafe postMessage handler was found.
- React text interpolation escapes mnemonics, feedback, tokens, names, and imported strings.
- Screenshot links are server-generated short-lived signed URLs and use `rel=noreferrer`.
- Object URLs are used for local previews/downloads; they are not executable HTML sinks. CSP blocks object embedding and non-self scripts.
- Backup JSON is schema validated and never interpreted as code. Zod strips/validates structure, preventing prototype keys from becoming executable behavior.

## 17. Dependency/supply-chain audit

- `npm audit` reported 0 vulnerabilities across 421 dependencies (production/dev/optional/peer metadata).
- Lockfile is present and CI uses `npm ci`.
- Several major upgrades are available but no advisory requires an emergency upgrade. Upgrade separately with regression testing.
- GitHub Actions uses least-privilege `contents: read`, but action allow-list/SHA pinning remains open (F-07).

## 18. Production configuration requirements

- Set Supabase Site URL and explicit redirects to the final HTTPS origin.
- Update Edge `APP_URL` to the same exact origin; keep the WCA callback registered exactly as currently deployed.
- Register the production Google authorized origin/callback in Google and Supabase.
- Deploy Cloudflare Pages from the reviewed production commit and verify `_headers` over HTTPS.
- Configure WCA/sync abuse limits and monitoring; decide CAPTCHA/Turnstile for Auth.
- Keep service-role, WCA secret, access token, and DB password outside Cloudflare client variables and all `VITE_` variables.

## 19. Live adversarial tests performed

- anonymous read private sync table → 401;
- anonymous read feedback inbox/admin RPC → 401;
- malformed JWT to REST and feedback Edge Function → 401;
- random authenticated UUID sees zero user/admin data;
- authenticated direct sync insert → permission denied;
- valid revision RPC write → success, transaction rolled back;
- stale revision, duplicate record, invalid solve ID → rejected;
- direct feedback insert and direct screenshot upload → rejected;
- feedback rate limiter → attempts 1–10 accepted, 11 rejected, transaction rolled back;
- one valid temporary feedback row → 201, then deleted;
- invalid oversized feedback field/path → rejected without persistent data;
- WCA redirect override → ignored; fixed callback retained;
- WCA method, state, scope, cookie, and callback behavior → verified.

No real user data was modified. Temporary database operations used transactions/rollback except one feedback row, which was immediately deleted. No temporary Auth accounts or Storage objects remain.

## 20. Fixes made

- migrations `202609280005`–`008`: sync grant/RPC hardening, feedback constraints/rate boundary, minimal service grant, solve-video/helper hardening;
- new deployed `submit-feedback` Edge Function and client routing;
- WCA GET-only and generic error handling, deployed;
- Cloudflare-compatible security headers;
- 25 MB backup pre-read limit;
- regression assertions for sync/feedback migration boundaries.

## 21. Tests/results

- Vitest: 20 files, 82 tests passed.
- TypeScript: passed as part of `npm run build`.
- ESLint: 0 errors, 8 pre-existing unused-disable warnings.
- Production build: passed; 2,675 modules transformed.
- Playwright: 17/17 passed in a clean non-overlapping run.
- `npm audit`: 0 known vulnerabilities.
- Dist scan: 0 source maps; no protected local secret matches; `_headers` copied.
- Live schema/grant/RLS/RPC/Edge/Storage probes: passed as described above.

## 22. Remaining risks

- WCA v0 API stability and email-linking trust dependency.
- No app-specific infrastructure rate limit yet for WCA or sustained sync calls.
- Full sync snapshots/tombstones and admin feedback listing are not paginated.
- File signatures are validated, but files are not decoded/re-encoded or malware scanned.
- Browser local data/session remain exposed if a future same-origin XSS is introduced.
- Security headers are code-complete but not verified on a Cloudflare deployment.

## 23. Exact items that MUST be completed before launch

1. Configure the exact production Supabase Site URL/redirect allow-list, Google OAuth origin/callback, and Edge `APP_URL`; test both providers from the deployed origin.
2. Deploy the reviewed build to a non-production preview and verify CSP/HSTS/clickjacking/permissions headers plus all primary routes under CSP.
3. Add/confirm infrastructure rate limits for WCA start/callback and sync; enable monitoring/alerts appropriate to Free-tier quotas.
4. Decide and document CAPTCHA/Turnstile posture for public Auth; test it with both supported sign-in methods if enabled.
5. Restrict/pin GitHub Actions or explicitly accept the supply-chain risk and maintain a manual release checklist.
6. Run one final authenticated user-A/user-B Storage test when solve-video upload is actually enabled; the current policy is correct by inspection but the feature has no active client flow.

## 24. Items safe to defer until after launch

- self-host the remaining Google fonts and tighten style CSP;
- paginate/compact sync history before large user histories exist;
- paginate the admin inbox;
- image decode/re-encode or malware scanning if screenshot threat/volume justifies it;
- deploy/harden the dormant CubeIQ FastAPI service only if that separate product path is activated;
- major dependency upgrades with normal regression testing.

## 25. Commit hashes

- Audit baseline: `2ad03fef6bf167dbf32f06daa74eb915852bcc9b`.
- Security hardening: the commit containing this report (recorded in the task's final response; a commit cannot embed its own final hash).

Primary references: [Supabase Storage access control](https://supabase.com/docs/guides/storage/security/access-control), [Supabase Auth redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls), [Supabase Auth rate limits](https://supabase.com/docs/guides/auth/rate-limits), and [WCA v0 OAuth documentation](https://docs.worldcubeassociation.org/knowledge_base/v0_api.html).
