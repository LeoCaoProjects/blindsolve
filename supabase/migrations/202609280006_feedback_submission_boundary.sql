-- Public feedback is accepted only through the rate-limited Edge Function.
-- Direct PostgREST and Storage writes would otherwise bypass abuse controls.

create table public.feedback_submission_limits (
  fingerprint text primary key check (fingerprint ~ '^[0-9a-f]{64}$'),
  window_started_at timestamptz not null default now(),
  submission_count integer not null default 1 check (submission_count > 0),
  updated_at timestamptz not null default now()
);

alter table public.feedback_submission_limits enable row level security;
revoke all on table public.feedback_submission_limits from public, anon, authenticated;

create or replace function public.consume_feedback_submission_slot(p_fingerprint text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  accepted boolean;
begin
  if p_fingerprint is null or p_fingerprint !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid feedback fingerprint' using errcode = '22023';
  end if;

  insert into public.feedback_submission_limits as limits(
    fingerprint, window_started_at, submission_count, updated_at
  ) values (p_fingerprint, now(), 1, now())
  on conflict (fingerprint) do update
    set window_started_at = case
          when limits.window_started_at <= now() - interval '1 hour' then now()
          else limits.window_started_at
        end,
        submission_count = case
          when limits.window_started_at <= now() - interval '1 hour' then 1
          else least(limits.submission_count + 1, 11)
        end,
        updated_at = now()
  returning submission_count <= 10 into accepted;

  return accepted;
end;
$$;

revoke all on function public.consume_feedback_submission_slot(text) from public, anon, authenticated;
grant execute on function public.consume_feedback_submission_slot(text) to service_role;

revoke insert on table public.feedback from anon, authenticated;
drop policy if exists feedback_anyone_create on public.feedback;

drop policy if exists feedback_screenshot_create on storage.objects;

