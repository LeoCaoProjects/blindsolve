# CubeIQ

CubeIQ is an evidence-aware 3×3 solve analytics application. Its defining goal is to reconstruct a human solve from one ordinary camera while keeping observations, cube states, candidate moves, orientation, and timing uncertainty separate.

This repository now also contains a complete responsive 3BLD training client:

- React, TypeScript, and Vite;
- a `cubing.js` `333bf` random-state timer and memo trainer;
- typed sticker-oriented BLD tracing with explicit cycle-break pauses;
- a custom-token Speffz lettering editor and collision-free pair identity;
- letter-pair matrix, hidden mnemonic suggestions, uniform-random flashcards, and JSON backups;
- a Supabase Auth/RLS extension migration for private schemes, pairs, aliases, attempts, and solves.

The pre-existing camera/CFOP backend proof point remains intact:

- a FastAPI HTTP service;
- a cubie-state model with legal-state validation and all 18 face moves;
- solve, observation, analysis, timeline, and stage-metric persistence models;
- per-user Supabase RLS policies and a private solve-video bucket;
- explicit `observed`, `device`, `inferred`, `ambiguous`, and `unresolved` evidence states;
- tests for cube invariants and uncertainty-preserving API validation.

It does **not** claim camera reconstruction accuracy yet. That claim requires the labeled-video gates in `PROJECT_BRIEF.md`.

## Supabase isolation requirement

The migration in `supabase/migrations/202609250001_initial_cubeiq.sql` must only be applied to a newly created, dedicated CubeIQ Supabase project. Never point `.env` or migration commands at an existing project. The checked-in `.env.example` intentionally contains placeholders and no credentials.

## Run locally

Frontend:

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

The frontend works in explicit local mode without Supabase (the example placeholders are treated as unconfigured). To enable account sync, create a dedicated Supabase project, apply all three migrations in filename order, and fill `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Enable email OTP and add your local/production `/settings` URLs to the Auth redirect allowlist. Restart Vite after changing the environment. Never use a service-role key in the browser.

Build and test with `npm run build`, `npm test`, and `npm run lint`. Run browser workflows and screenshot capture with `npm run test:e2e` (uses installed Microsoft Edge; change the Playwright channel if needed). Production hosting must rewrite app routes such as `/pairs` to `index.html`.

## V2 training client

See [design audit](docs/V2_DESIGN_AUDIT.md), [design system](docs/V2_DESIGN_SYSTEM.md), and [verification and limitations](docs/V2_VERIFICATION.md). All five screens use real routes. The timer isolates its animation frame updates; the pair grid supports arrow keys and Enter; dialogs trap and restore focus; flashcards remain uniformly random; memo exercises preserve the corner/edge boundary and physical sticker identity.

V2 synchronizes one atomic, revision-checked workspace through owner-only RLS. This prevents half-saved aliases/settings and rejects stale writes. V1 normalized tables are read on first use when no snapshot exists and are never deleted. Device data stays separate from each signed-in account; importing the device workspace is explicit. Conflicting primary words become alternates, older lettering configurations are retained, and deletion tombstones prevent an old backup resurrecting deleted solves. Retry sync merges concurrent changes before resubmitting. For large datasets, move append-only history to paginated normalized storage; V2 snapshots are limited to 20 MB.

Export JSON in Settings before clearing browser storage. Import validates structure/timings/stickers, previews contents, downloads a pre-import backup, and merges records. Restoring lettering and buffers is an explicit checkbox. No analytics or external fonts are fetched. This version has JSON portability, not CSV import/export.

Backend:

```powershell
py -m venv .venv
.venv\Scripts\Activate.ps1
pip install -e ".[dev]"
Copy-Item .env.example .env
uvicorn backend.app.main:app --reload
```

`GET /health` works before Supabase is configured and reports `supabase_configured: false`. Authenticated routes return `503` until the new project's URL and anon key are supplied.

Run tests with:

```powershell
pytest
```

## API shape

- `GET /health`
- `GET|POST /v1/solves`
- `GET|PATCH|DELETE /v1/solves/{solve_id}`
- `POST /v1/solves/{solve_id}/analysis-runs`
- `PUT /v1/analysis-runs/{run_id}/timeline`

Authenticated endpoints accept a Supabase user access token as `Authorization: Bearer <token>`. The API forwards that token to PostgREST, so database RLS remains the authorization boundary; it does not use a service-role key.

## Data trust boundaries

- `intended_state` records the state produced by applying the displayed scramble; it is not a verified physical start.
- Frame observations remain partial JSON evidence and never masquerade as a full cube state.
- Timeline gaps cannot have definitive move notation.
- State, move identity, and timing confidence are stored independently.
- A new `analysis_run` preserves versioned reanalysis instead of overwriting raw evidence.
