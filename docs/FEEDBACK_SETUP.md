# Feedback and admin setup

BlindSolve stores feedback in Supabase using the migration in
`supabase/migrations/202609270001_feedback.sql`.

Apply the migration with the normal Supabase migration workflow. It creates:

- the `feedback` table and status/category enums;
- the server-authorized `feedback_admins` allow-list;
- Row Level Security policies that allow public creation but admin-only reads,
  updates, and deletion;
- a private `feedback-screenshots` Storage bucket with image-only, 5 MB uploads.

To bootstrap an administrator, use the Supabase SQL editor or another trusted
server-side migration context after the user has signed in:

```sql
insert into public.feedback_admins (user_id)
values ('00000000-0000-0000-0000-000000000000');
```

Replace the example UUID with the user's Supabase Auth user ID. Do not expose
the service-role key or implement administrator selection in the browser.

Anonymous feedback can include an optional contact email. Signed-in feedback
is associated with `auth.uid()` by the database. Screenshots are never captured
automatically; they are uploaded only when the user selects a file, and the
stored objects are not publicly readable or enumerable.
