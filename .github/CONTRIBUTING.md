# Contributing

Open an issue before a substantial change. Submit focused pull requests against
`main`, explaining what changed and how you checked it. Use synthetic data;
never commit credentials, real account data or personal backups.

## Finding the code

- `web/src/domain/`: cube mechanics and letter-pair identity.
- `web/src/data/`: persistence, sync and recovery.
- `web/src/workspace/`: screens, components and practice sessions.
- `supabase/`: database migrations, access-policy tests and Edge functions.

Lettering changes must not rename or delete saved words. Keep logical token-pair
identity separate from physical sticker IDs, and preserve deletion markers and
legacy backup formats. Tests beside the relevant modules cover these contracts.

CSS uses rem-based design units. Use `designRem` for inline design dimensions;
DOM measurements already return CSS pixels and must not be scaled again. See
[`useDesignPixels.ts`](../web/src/workspace/hooks/useDesignPixels.ts) and the
[PostCSS conversion](../web/scripts/ui-design-units.mjs).

## Checks

Follow the [README](../README.md#running-locally) to install dependencies.
From `web/`, run focused tests while working and these checks before a PR:

```sh
npm test
npm run lint
npm run typecheck
npm run build
npm run test:seo
```

The last command checks generated page metadata, routes and security/cache headers.
For browser tests, install Chromium with `npx playwright install chromium`.
Then run `CI=true npm run test:e2e -- --workers=1 --retries=0` in Bash, or
`$env:CI="true"; npm run test:e2e -- --workers=1 --retries=0` in PowerShell.
`CI=true` selects Chromium instead of the default Edge browser. To run one case,
append a filename and `-g "test title"`. Failure traces stay in `web/test-results/`.

## Cloud features

Use a local or disposable Supabase project, never production data or credentials.
Apply all migrations in `supabase/migrations/` in order; see the
[Supabase migration guide](https://supabase.com/docs/guides/local-development/database-migrations).
Copy `web/.env.example` to `web/.env.local` and set `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY` to that project's public client configuration.

Enable the Google Auth provider and allow your app's development redirect URL.
WCA sign-in uses `supabase/functions/wca-oauth/`; feedback uses
`supabase/functions/submit-feedback/`. Configure their
[server environment](https://supabase.com/docs/guides/functions/secrets)
with `APP_URL`, `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; WCA also needs
`WCA_CLIENT_ID` and `WCA_CLIENT_SECRET`. Register the WCA callback as
`<SUPABASE_URL>/functions/v1/wca-oauth/callback`. Keep OAuth secrets and the
service-role key out of `VITE_` variables. Use HTTPS when testing the WCA flow,
which uses a Secure cookie.

Feedback administration is controlled by `public.feedback_admins`. After a test
user signs in, add their Auth user ID through a trusted SQL connection:

```sql
insert into public.feedback_admins (user_id) values ('<AUTH_USER_UUID>');
```

The migrations create the private screenshot bucket and access policies;
feedback submission goes through the Edge function, not direct browser inserts.

## Database tests

These tests check sync writes, deletion handling and which user can access each
record. They create synthetic users inside a rolled-back transaction. With Docker
running, use Bash from the repository root to create a separate local stack:

```sh
db_workdir=$(mktemp -d)
npx --yes supabase@3.0.0 init --workdir "$db_workdir" --yes
cp -R supabase/migrations supabase/tests "$db_workdir/supabase/"
npx --yes supabase@3.0.0 start --workdir "$db_workdir" --exclude studio,imgproxy,edge-runtime,logflare,vector,supavisor
npx --yes supabase@3.0.0 test db --workdir "$db_workdir"
npx --yes supabase@3.0.0 stop --workdir "$db_workdir"
```

Stop the stack even if a test fails. Do not link it to a hosted project or use
`--remote`. The [CI workflow](workflows/ci.yml) runs the same isolated checks.
