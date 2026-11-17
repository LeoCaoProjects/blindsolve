# BlindSolve

BlindSolve is a web app for practising 3×3 blindfolded cube solving (3BLD).
Time your solves, review them, and practise remembering letter pairs and
recognising targets.

[![Open BlindSolve](.github/assets/open-blindsolve.svg)](https://blindsolve.com)

<p align="center">
  <img src=".github/assets/blindsolve-timer.png" alt="BlindSolve timer, scrambled cube and solve history" width="1200">
</p>

## Features

- A solve timer with memo and execution splits
- Reconstruction to review a solve
- Letter-pair words and flashcards
- Recall, tracing, execution and guided-solve practice
- Target Recognition using the colours of scrambled pieces
- Saved history, backups and recovery

## Built with

React, TypeScript, Vite, Tailwind CSS and cubing.js. Optional cloud features
use Supabase.

## Running locally

Install Node.js 24.12 or newer and npm. From the repository folder:

```sh
cd web
npm ci
npm run dev
```

Open the address printed in the terminal, usually `http://localhost:5173`.

The timer, training, letter pairs, flashcards, history and backups work
without Supabase. No account or environment file is needed; your saved data
stays in this browser.

<details>
<summary>Optional cloud setup</summary>

Sign-in, sync and feedback require your own Supabase project.
Copy [web/.env.example](web/.env.example) to `web/.env.local` and fill in
your project's values. Never use BlindSolve production credentials or data
for local development.

</details>

To build the app, run `npm run build` from `web/`. The files go into `web/dist/`.

## Testing

From `web/`:

```sh
npm test
npm run lint
npm run typecheck
```

<details>
<summary>Advanced local testing</summary>

Advanced provider/security and Admin testing use a disposable local Supabase
stack. See the [CI workflow](.github/workflows/ci.yml),
[security tests](web/tests/infrastructure/provider.mjs) and
[Admin setup script](web/scripts/seed-admin-local.mjs) for the exact setup.

</details>

## License

BlindSolve is licensed under the [MIT License](LICENSE). See
[third-party notices](web/public/THIRD-PARTY-NOTICES.txt) for software and
assets with separate terms.
