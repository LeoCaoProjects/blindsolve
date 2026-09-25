# CubeIQ V2 — delivery and verification

## What changed

All five training screens were rebuilt around real routes and a shared, restrained design system. No camera/CFOP backend code or original migration was removed. The original nine frontend tests remain; actual BLD defects were changed only after independent reference checks described in `BLD_RESEARCH.md`.

The timer has isolated animation-frame rendering, monotonic split measurements, immediate local solve persistence, DNF editing, history details, deletion with Undo, older-history access, and navigation protection while running. Memo reconstruction is progressively disclosed. Cycle breaks use an accessible list or a highlighted 2D map; mnemonic reconciliation offers replace/add/keep and saves unknown pairs directly.

The matrix has sticky axes, roving arrow/Home/End focus, Enter-to-edit, Escape and focus restoration, separate edge/corner views, compact search results, coverage filters, and deliberate suggestion disclosure. Flashcards remain uniformly random, support keyboard scoring, and can edit words/alternates without leaving practice. Memo exercises use genuine 333bf states and preserve edge/corner pair boundaries and multi-character token identity.

Settings include an editable cube net, buffers, orientation, method disclosures, draft validation, explicit saves, previous-setup recovery, and unsaved-change protection. JSON imports validate and preview before merging; a pre-import export is generated, and restoring the backup's setup is explicit.

## Architecture and data safety

- `src/pages/`: route-level screens, loaded on demand.
- `src/components/`: accessible dialog, lettering net, memo strip, cube renderer, pair editor, route guard.
- `src/features/timer/`: high-frequency clock and post-solve reconstruction.
- `src/domain/`: independently testable cubing/BLD and letter-pair logic.
- `src/app/Store.tsx`: account lifecycle, device persistence, serialized sync, cross-tab merge.
- `src/lib/repository.ts`: schema validation, migration, conflict merge, portable backups and RPC boundary.

Device and account data use distinct namespaces. Sign-in does not silently upload guest data. Cloud writes use one atomic revision-checked snapshot, rejecting stale writes rather than overwriting another device. Failed writes remain local and expose Retry. Different primary words are retained as alternates; different setups are recoverable; solves use tombstones. V1 tables are read without deletion when no V2 snapshot exists. Snapshots have a 20 MB service limit; very large multi-year datasets warrant normalized/paginated append-only history rather than ever-larger snapshots.

## Visual review and iteration

Baseline V1 was inspected in-browser at 1440×900, 1024×768 and 390×844 before the redesign. Baseline screenshots were emitted during the working session but were not retained as separate repository image files. No recreated “before” images are presented as evidence.

After implementation, Playwright captured all five screens at widths 390, 768, 1024, 1440 and 1920. Screenshots are in `docs/screenshots/v2/`; fixture mnemonics are test data in isolated browser contexts, not added to a user's workspace. Selected captures were visually inspected, not merely generated.

The review led to a second pass: move the sticker-map action into the cube's visual column, keep focus-mode controls at readable contrast, wrap long custom tokens and words, protect active solves/drafts, explicitly wrap dialog Tab navigation on mobile, and retain competing lettering setups. The orientation-aware net uses actual face colours for the chosen top/front hold.

No-slop review: no decorative gradients, glass, glow, floating content cards, KPI filler, hero marketing, pills for ordinary buttons, hover scaling, or decorative icon headings. Table borders communicate cells; the dialog shadow communicates elevation; cube colours describe facelets. Page compositions differ by task rather than sharing a dashboard template.

## Verification commands

Final local results (2026-09-25): **32 unit tests passed**, **13 Playwright tests passed**, production build passed, ESLint passed without warnings. The full browser suite was rerun after the last interaction/visual changes. Screenshots were regenerated with the library renderer's introductory fade settled.

- `npm test`: BLD fixtures/invariants, custom labels, pair comparison/checking, import/merge integrity, account isolation, token refresh, failure/retry, writes during network latency, random-selection intervals, orientation mapping.
- `npm run test:e2e`: pairs, flashcards, correct/incorrect memo, timing and reconstruction, mnemonic reconciliation, backups, empty/dense/long-content states, mobile touch, reduced motion, dialog focus, route guards, Back/Forward/reload, screenshots and page overflow.
- Axe checks cover all five pages plus pair dialogs in both themes against WCAG A/AA rules. Automated success is not a claim of exhaustive screen-reader or accessibility certification.
- `npm run build` and `npm run lint`.
- `npm audit`: patched the existing development-only Vitest advisory; zero reported vulnerabilities after upgrade.

The final command results are recorded in the delivery message. Vite's remaining large-chunk warnings come from cubing.js's on-demand 3D and scramble/WASM modules. There are also harmless dependency comment-annotation warnings from Zod. No synthetic performance score or camera-accuracy claim is made.

## External setup and remaining limitations

Live Supabase email delivery and database execution could not be verified without a dedicated project and credentials. The single external setup workflow is: create/select the dedicated CubeIQ Supabase project, apply all three checked-in migrations in order, configure email Auth redirect URLs, and set the public URL/anon key in `.env`. See `README.md`. Never use a frontend service-role key.

`supabase/tests/bld_workspace_rls.sql` contains owner-isolation/concurrency checks for a dedicated local Supabase test database. It has not been executed here. Auth state and sync failures are tested with mocks, not represented as live end-to-end cloud tests.

3D sticker text/hit-testing is not supplied by the public renderer API; the correct 2D labelled map is the explicit fallback. Execution algorithms, M2 substitutions and alternate dedicated flip/twist memo styles are not claimed. JSON backup is implemented; CSV is not. The untouched Python backend was not reverified in the resumed environment because pytest is not installed.

Dependency licence notes: application runtime uses packages under their declared licences; fonts are self-hosted under OFL-1.1, cubing.js under MPL-2.0, React Router/Zod under MIT, Playwright under Apache-2.0. No csTimer GPL source was copied.
