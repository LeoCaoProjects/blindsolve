-- BlindSolve feedback inbox. Anonymous users may submit; only server-authorized admins may read or manage it.
create type public.feedback_category as enum ('bug', 'feature', 'general');
create type public.feedback_status as enum ('new', 'reviewing', 'planned', 'resolved', 'archived');

create table public.feedback_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.feedback_admins enable row level security;

create or replace function public.is_feedback_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.feedback_admins where user_id = auth.uid());
$$;

revoke all on function public.is_feedback_admin() from public;
grant execute on function public.is_feedback_admin() to authenticated;

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  contact_email text,
  category public.feedback_category not null,
  message text not null check (char_length(btrim(message)) between 1 and 10000),
  status public.feedback_status not null default 'new',
  source_page text not null default 'Unknown',
  technical_context jsonb,
  screenshot_path text,
  screenshot_name text,
  submitter_name text,
  submitter_detail text,
  submitter_provider text check (submitter_provider in ('wca', 'google')),
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.feedback enable row level security;

create policy feedback_anyone_create on public.feedback
for insert to anon, authenticated
with check (
  status = 'new'
  and admin_note is null
  and ((auth.uid() is null and user_id is null) or user_id = auth.uid())
);

create policy feedback_admin_read on public.feedback
for select to authenticated using (public.is_feedback_admin());
create policy feedback_admin_update on public.feedback
for update to authenticated using (public.is_feedback_admin()) with check (public.is_feedback_admin());
create policy feedback_admin_delete on public.feedback
for delete to authenticated using (public.is_feedback_admin());

create or replace function public.touch_feedback_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger feedback_updated_at before update on public.feedback
for each row execute function public.touch_feedback_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('feedback-screenshots', 'feedback-screenshots', false, 5242880, array['image/png','image/jpeg','image/webp','image/gif'])
on conflict (id) do nothing;

create policy feedback_screenshot_create on storage.objects
for insert to anon, authenticated
with check (bucket_id = 'feedback-screenshots');
create policy feedback_screenshot_admin_read on storage.objects
for select to authenticated
using (bucket_id = 'feedback-screenshots' and public.is_feedback_admin());
create policy feedback_screenshot_admin_delete on storage.objects
for delete to authenticated
using (bucket_id = 'feedback-screenshots' and public.is_feedback_admin());

-- Bootstrap an administrator after deployment with a trusted SQL session:
-- insert into public.feedback_admins (user_id) values ('<auth.users.id>');
