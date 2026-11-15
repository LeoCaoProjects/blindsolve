# Cloud development

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
