# Blindsolve

A private 3×3 blindfolded-solving trainer, with a separate early CubeIQ solve-analysis foundation.

## About

Blindsolve includes a letter-pair database, random flashcards, realistic BLD memo training, a blind timer, and configurable sticker lettering. It uses real cube states and keeps cycle breaks separate from the memo representation.

The repository also retains CubeIQ's evidence-aware camera-analysis work. That work is still exploratory and does not claim reliable camera reconstruction yet.

## Built with

React, TypeScript, Vite, cubing.js, Supabase, and FastAPI.

## Local setup

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

The frontend works locally without Supabase. For account sync, create a dedicated Supabase project, apply the migrations in `supabase/migrations`, and provide the public URL and anon key in `.env`. Enable Google in Supabase Auth and add the deployed site URL to its redirect allow-list.

WCA sign-in uses the checked-in `wca-oauth` Edge Function so the OAuth secret never enters the browser. Register an OAuth application at the WCA, using `https://YOUR_PROJECT.supabase.co/functions/v1/wca-oauth/callback` as its callback, then configure and deploy:

```powershell
supabase secrets set APP_URL=https://YOUR_SITE WCA_CLIENT_ID=... WCA_CLIENT_SECRET=...
supabase functions deploy wca-oauth --no-verify-jwt
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are supplied to deployed functions by Supabase. Never place the service-role key or WCA secret in a `VITE_` variable or frontend code.

Run checks with `npm test`, `npm run lint`, `npm run build`, and `npm run test:e2e`.

See [maintenance checks](docs/maintenance.md) for read-only capacity SQL, cache verification, storage recovery and isolated database contract tests.
