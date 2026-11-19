<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset=".github/assets/blindsolve-wordmark-dark.svg">
    <img src=".github/assets/blindsolve-wordmark-light.svg" alt="blindsolve" width="240">
  </picture>
</p>

<p align="center">
  A workspace for 3×3 blindfolded solving. Time your solves, train your recall, and learn your letter pairs.
</p>

<p align="center">
  <img src=".github/assets/blindsolve-timer.png" alt="BlindSolve timer, scrambled cube and solve history" width="1200">
</p>

## Features

- Time solves with memo and execution splits
- Review solves with reconstruction
- Learn letter pairs with custom words and flashcards
- Practise recall, tracing, execution and guided solves
- Practise recognising targets on a scrambled cube
- Keep solve history and export or restore backups

## Quick start

Install Node.js 24.12 or newer and npm. From the repository folder:

```sh
cd web
npm ci
npm run dev
```

Open the address printed in the terminal, usually `http://localhost:5173`.

No account or Supabase setup required. Your data stays in your browser.

<details>
<summary>Optional cloud setup</summary>

Sign-in, sync and feedback require your own Supabase project.
Copy [web/.env.example](web/.env.example) to `web/.env.local` and fill in
your project's values. Never use BlindSolve production credentials or data
for local development.

</details>

## Development

From `web/`:

```sh
npm test
npm run lint
npm run typecheck
npm run build
```

The production build is written to `web/dist/`.

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
