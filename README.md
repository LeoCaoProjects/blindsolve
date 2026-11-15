# BlindSolve

A web app for practising 3×3 blindfolded solving (3BLD).

[blindsolve.com](https://blindsolve.com)

## About

I built BlindSolve for my own 3BLD practice. It brings timing, reviewing
solves and practising the individual skills into one place.

## Features

- A blindfolded solve timer with memo and execution splits, and reconstruction
- Letter-pair words and flashcards
- Training for recall, tracing and execution, including guided solves
- Target Recognition practice using the colours of scrambled pieces
- Saved solve and practice history, with backup and recovery

## Built with

- React and TypeScript
- Vite and Tailwind CSS
- cubing.js
- Supabase

## Running locally

Use Node.js 24.12 or newer, npm and Git.

Clone this repository and open its folder. The frontend lives in `web/`:

```sh
cd web
npm ci
npm run dev
```

Open the local address printed by Vite, usually `http://localhost:5173`.

No environment file is needed for local practice. The timer, Training,
letter pairs, flashcards, local history and backups work without Supabase.
Signing in, cloud sync and feedback require it.

Cloud features need a configured Supabase project, including the migrations
and Edge functions in `supabase/`.

To use those features, copy `web/.env.example` to `web/.env.local` and set
`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for a local or disposable
Supabase project. Do not use production credentials.

Run `npm run build` from `web/` to create a static build in `web/dist/`.

## Testing

From `web/`:

```sh
npm test
npm run lint
npm run typecheck
```

After a build, `npm run test:seo` checks the generated pages and headers.
See the [contribution guide](.github/CONTRIBUTING.md) for browser and
database checks.

## Contributing

See the [contribution guide](.github/CONTRIBUTING.md) before opening a pull
request. Please report vulnerabilities through the
[security guide](.github/SECURITY.md).

## License

Original BlindSolve code is covered by the [MIT license](LICENSE).
Libraries and assets have their own terms in the
[third-party notices](web/public/THIRD-PARTY-NOTICES.txt).

The [mnemonic dataset](docs/LETTER_PAIR_SOURCES.md) is excluded from the MIT
grant while its redistribution rights remain unconfirmed. Publication is
on hold until that is resolved.
