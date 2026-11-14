# BlindSolve

BlindSolve is a web app for practising 3BLD, with a solve timer, reconstruction,
letter pairs, flashcards and training.

## Development

Install Node.js 24.12 or newer, then run:

```sh
cd web
npm ci
npm run dev
```

The app works locally without an account. Optional cloud features use Supabase;
`web/.env.example` lists the configuration. Use a separate development project.

From `web/`, run `npm test`, `npm run lint`, `npm run typecheck` and
`npm run build`. The production output goes into `web/dist/`.

## Structure

- `web/`: frontend source, assets, tests and build tools.
- `supabase/`: migrations, database tests and Edge functions.
- `docs/`: technical references and asset provenance.
- `.github/`: contributor information and CI.
