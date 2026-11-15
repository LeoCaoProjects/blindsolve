# Development

- Use `cd web` then `npm ci` and keep the lockfile aligned. CI uses Node.js 22. Keep the domain independent of workspace rendering.
- Run `npm run typecheck` and focused tests such as `npx vitest run src/data/repository.test.ts`. Build with `npm run build` and verify generated SEO and headers with `npm run test:seo`.
- Install the Playwright browser for your environment. CI uses Chromium and the Windows local configuration uses Edge. Run focused selectors with `npx playwright test <file> -g <selector>`. Generated screenshots, reports and traces belong in Playwright output directories.
- For database work, use a fresh unlinked disposable stack with synthetic accounts. Verify destinations before running migrations or tests. Follow the CI database job and [maintenance notes](../docs/maintenance.md).
- Preserve owner scope, record identity, legacy formats and deletion precedence. Add fixtures when a change affects historical data.
- Keep private release reports outside the repository. Generated builds, TypeScript caches, test artifacts and local environment files are ignored.

Open an issue for substantial changes, then submit a focused pull request against `main`. Explain the behavior change and checks run. Do not include real backups, account data or credentials.

Run Supabase CLI commands from the repository root, separately from the frontend package. CI resolves npm/cache/browser artifact paths under `web/`; database paths remain rooted at `supabase/`.
