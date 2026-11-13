# BlindSolve

BlindSolve is a 3×3 blindfolded-solving trainer with a split timer and memo reconstruction, five Training modes, editable Letter Pairs and Flashcards, and configurable sticker lettering and buffers.

## Run locally

Use Node.js 22 and npm. The frontend works without an account or backend.

    npm ci
    npm run dev

For isolated account testing, copy .env.example to .env.local and use the public URL and client key of your disposable local Supabase stack. Keep the sample values to run without sign-in. CI applies the checked-in migrations to a fresh local stack. See [development](CONTRIBUTING.md) and [maintenance](docs/maintenance.md).

## Architecture

| Path | Responsibility |
| --- | --- |
| src/main.tsx, src/App.tsx | Browser entry, owner store and recovered-workspace boundary |
| src/workspace | Routes, session shell, Timer, Training, Pairs, Flashcards, Settings and shared interaction components |
| src/domain | BLD tracing, physical sticker identities, lettering and logical pair rules |
| src/app, src/lib | Owner-scoped persistence, validation, sync, tombstones, recovery and provider adapters |
| supabase | Ordered migrations, database policy fixtures, diagnostics and Edge functions |
| backend | Experimental FastAPI camera-analysis foundation |
| e2e, colocated tests and scripts | Browser workflows, focused tests and reproducible tooling |

Normal backups and restored workspaces preserve known deletion markers. V1 review exports preserve owner records separately from canonical history. See [logical pair identities](docs/logical-pair-model.md), [Target Recognition](docs/target-recognition.md) and [security](SECURITY.md). Distribution licensing remains a repository-owner decision.
