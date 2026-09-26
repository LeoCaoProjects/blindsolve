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

The frontend works locally without Supabase. For account sync, create a dedicated Supabase project, apply the migrations in `supabase/migrations`, and provide the public URL and anon key in `.env`. Do not use a service-role key in the browser.

Run checks with `npm test`, `npm run lint`, `npm run build`, and `npm run test:e2e`.
