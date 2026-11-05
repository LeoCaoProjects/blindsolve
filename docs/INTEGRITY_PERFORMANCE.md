# Integrity and performance pass

Deletion now has durable, owner-scoped negative metadata. Hydration retains remote tombstones; local pending deletions beat stale live snapshots and queued upserts. Solve and attempt IDs cannot be revived by later stale writes. Pair keys can still be deliberately recreated. Absence alone never means deletion. Account hydration reads the latest local envelope after awaiting the server. Cross-tab merges persist combined deletion evidence; queued cloud batches check their owner before every chunk and pin the request token to that owner across asynchronous SDK preparation.

The server migration preserves authentication, revision conflicts, advisory serialization, validation, rate limits and grants. It creates deletion markers even for IDs not previously uploaded and guards deleted history against old-client upserts. It updates functions/triggers only: no existing history rows are rewritten or deleted. Validation used temporary rows inside a rollback transaction before applying the approved migration.

Timer edits previously retimestamped every remaining solve in the session. They now modify only the selected records, preserving untouched object identities and newly hydrated records absent from the old view. No-op edits do not start sync.

## Measured local production builds

Isolated Edge browser fixtures; no synthetic production-account records. Values vary by machine and run. Interaction includes Playwright input dispatch, selection acknowledgement and two animation frames.

| 10,000 records | Before | After |
|---|---:|---:|
| Timer mounted rows | 10,000 | 42 |
| Training mounted rows (2,500 in selected mode) | 2,500 | 23 |
| Timer ready | 47.0 s | 1.61 s |
| Timer to Training | 3.39 s | 276 ms |
| Training ready | 8.04 s | 1.53 s |
| Training mode switch | 10.88 s | 218 ms |
| Timer interaction heap | 366.8 MB | 19.3 MB |
| Training interaction heap | 173.6 MB | 15.4 MB |

The original 540-record fixture also reproduced lag: Training mode selection took about 800 ms. Oversized mounted history trees and per-row layout/exit animations were the primary measured costs. Windowing removes those trees; stable scheme/pair dependencies avoid rebuilding unrelated training challenges during sync updates. Training histories derive only their own mode. Mode content no longer waits for outgoing content to finish fading.

## Collection and retrieval audit

Timer, Training and Flashcard history use viewport windowing with overscan. Full records remain in the local store for statistics, export and offline use. Keyboard Home/End/arrows/page navigation can reach unmounted records. Session management uses pages of 40. Flashcards retains its existing recent-200-card policy. Admin feedback already queries a maximum of 100 rows. Letter Pairs axes and reconstruction targets are bounded cube vocabulary, not indefinitely growing histories. Tiny static lists remain ordinary lists.

Full account hydration remains necessary for the existing local-first statistics architecture. It occurs at sign-in, explicit retry and conflict reconciliation, not on route or mode switches. Bulk writes now use ordered batches of at most 500 changes and approximately 4.5 MB, preserving revision chaining and failed-write recovery. Statistics use complete data, with a single-pass best/success calculation that avoids argument-spread limits.

## Motion and layout

The old sidebar animated width every frame, forcing workspace resize and cube ResizeObserver updates. The new final 0/224px layout commits once; the workspace animates only translateX for 180 ms using cubic-bezier(0.22,1,0.36,1). Content opacity is 160 ms. Contextual-to-contextual navigation keeps its width. Reduced motion skips structural motion; text is never scaled and the shell clips overflow.

A shared scramble region reserves the wrapping geometry of 30 move tokens before loading finishes. Loading, ready and error occupy the same grid cell. Ready content appears immediately with a short opacity transition. Training worker failures are reported in that region, with retry; stale completions/errors cannot change a newer request. Background warm-up failures are handled.

Pieces/Show had an extra 12px wrapper inset on both sides and flex segments with label-dependent bases. Controls now align to the same outer box as mode navigation, with three/two equal grid columns. Each moving indicator fills its actual selected button. Letter Pairs uses a two-column token/count grid with adjacent counts, original ordering and keyboard semantics, plus a narrow scrollbar and stable gutter.

## Evidence and limits

Tests cover durable offline/signed-in deletion, reload, retries, account switching, repeated hydration, no-op sync, bounded bulk writes, latest scramble requests, large-history scrolling and keyboard access. Browser checks cover 1440x900, 1280x720, 1024x768, 900x560, 390x844 and 320x568, including measured scramble loading/ready rectangles and segmented-control alignment.

After the user clarified that the unexpected history was Execution Sprint rather than Timer, the scoped audit confirmed the large active dataset in cloud Training attempt records. Timer history was separately correct. Those active Training records have no surviving deletion flags identifying which should be removed; no speculative cleanup was performed. The current database snapshot cannot establish the complete historical write sequence or confidently identify the intended latest subset.
