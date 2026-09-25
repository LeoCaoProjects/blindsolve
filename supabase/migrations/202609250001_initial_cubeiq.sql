-- CubeIQ initial schema. Apply only to a newly created, dedicated CubeIQ project.
create extension if not exists pgcrypto;

create type public.solve_status as enum ('recording', 'uploaded', 'processing', 'complete', 'failed');
create type public.analysis_status as enum ('queued', 'running', 'complete', 'partial', 'failed');
create type public.evidence_kind as enum ('observed', 'device', 'inferred', 'ambiguous', 'unresolved');
create type public.analysis_input_kind as enum ('camera', 'smart_cube', 'manual', 'hybrid');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (char_length(display_name) <= 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.solves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status public.solve_status not null default 'recording',
  scramble text not null check (char_length(scramble) between 1 and 500),
  intended_state jsonb not null,
  verified_start_state jsonb,
  verified_end_state jsonb,
  endpoint_verified boolean not null default false,
  cross_color text check (char_length(cross_color) <= 20),
  initial_orientation jsonb,
  timer_source text not null default 'keyboard' check (char_length(timer_source) <= 40),
  started_at timestamptz,
  duration_ms integer check (duration_ms >= 0),
  timing_uncertainty_ms integer check (timing_uncertainty_ms >= 0),
  video_object_path text,
  video_capture_metadata jsonb not null default '{}'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.analysis_runs (
  id uuid primary key default gen_random_uuid(),
  solve_id uuid not null references public.solves(id) on delete cascade,
  status public.analysis_status not null default 'queued',
  input_kind public.analysis_input_kind not null,
  pipeline_version text not null check (char_length(pipeline_version) between 1 and 100),
  parameters jsonb not null default '{}'::jsonb,
  summary jsonb,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.frame_observations (
  id bigint generated always as identity primary key,
  analysis_run_id uuid not null references public.analysis_runs(id) on delete cascade,
  timestamp_ms integer not null check (timestamp_ms >= 0),
  visible_facelets jsonb not null default '[]'::jsonb,
  color_probabilities jsonb not null default '{}'::jsonb,
  center_evidence jsonb not null default '{}'::jsonb,
  orientation_candidates jsonb not null default '[]'::jsonb,
  geometry_score real check (geometry_score between 0 and 1),
  occlusion_score real check (occlusion_score between 0 and 1),
  raw_evidence jsonb not null default '{}'::jsonb,
  unique (analysis_run_id, timestamp_ms)
);

create table public.timeline_events (
  id bigint generated always as identity primary key,
  analysis_run_id uuid not null references public.analysis_runs(id) on delete cascade,
  sequence_no integer not null check (sequence_no >= 0),
  event_type text not null check (event_type in ('move', 'rotation', 'gap')),
  notation text check (char_length(notation) <= 20),
  time_start_ms integer not null check (time_start_ms >= 0),
  time_end_ms integer not null check (time_end_ms >= time_start_ms),
  evidence public.evidence_kind not null,
  state_confidence real check (state_confidence between 0 and 1),
  identity_confidence real check (identity_confidence between 0 and 1),
  timing_confidence real check (timing_confidence between 0 and 1),
  candidates jsonb not null default '[]'::jsonb,
  state_after jsonb,
  constraint gap_has_no_definitive_move check (event_type <> 'gap' or notation is null),
  unique (analysis_run_id, sequence_no)
);

create table public.stage_metrics (
  id bigint generated always as identity primary key,
  analysis_run_id uuid not null references public.analysis_runs(id) on delete cascade,
  stage_key text not null check (stage_key in ('cross','f2l1','f2l2','f2l3','f2l4','oll','pll','auf','other')),
  time_start_ms integer check (time_start_ms >= 0),
  time_end_ms integer check (time_end_ms >= time_start_ms),
  move_count integer check (move_count >= 0),
  average_tps real check (average_tps >= 0),
  execution_tps real check (execution_tps >= 0),
  case_key text,
  confidence real check (confidence between 0 and 1),
  metrics jsonb not null default '{}'::jsonb,
  unique (analysis_run_id, stage_key)
);

create index solves_user_created_idx on public.solves(user_id, created_at desc);
create index analysis_runs_solve_created_idx on public.analysis_runs(solve_id, created_at desc);
create index observations_run_time_idx on public.frame_observations(analysis_run_id, timestamp_ms);
create index timeline_run_sequence_idx on public.timeline_events(analysis_run_id, sequence_no);

create function public.touch_updated_at() returns trigger language plpgsql security invoker as $$
begin new.updated_at = now(); return new; end $$;
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger solves_touch before update on public.solves for each row execute function public.touch_updated_at();

create function public.create_profile_for_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin insert into public.profiles(id) values (new.id); return new; end $$;
create trigger auth_user_profile after insert on auth.users
for each row execute function public.create_profile_for_new_user();

create function public.owns_solve(target_solve_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.solves s where s.id = target_solve_id and s.user_id = auth.uid())
$$;
create function public.owns_analysis(target_run_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(
    select 1 from public.analysis_runs a join public.solves s on s.id = a.solve_id
    where a.id = target_run_id and s.user_id = auth.uid()
  )
$$;

alter table public.profiles enable row level security;
alter table public.solves enable row level security;
alter table public.analysis_runs enable row level security;
alter table public.frame_observations enable row level security;
alter table public.timeline_events enable row level security;
alter table public.stage_metrics enable row level security;

create policy profiles_owner_all on public.profiles for all to authenticated
using (id = auth.uid()) with check (id = auth.uid());
create policy solves_owner_all on public.solves for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy analysis_owner_all on public.analysis_runs for all to authenticated
using (public.owns_solve(solve_id)) with check (public.owns_solve(solve_id));
create policy observations_owner_all on public.frame_observations for all to authenticated
using (public.owns_analysis(analysis_run_id)) with check (public.owns_analysis(analysis_run_id));
create policy timeline_owner_all on public.timeline_events for all to authenticated
using (public.owns_analysis(analysis_run_id)) with check (public.owns_analysis(analysis_run_id));
create policy stages_owner_all on public.stage_metrics for all to authenticated
using (public.owns_analysis(analysis_run_id)) with check (public.owns_analysis(analysis_run_id));

create view public.solve_details with (security_invoker = true) as
select s.*,
  coalesce((select jsonb_agg(a order by a.created_at desc) from public.analysis_runs a where a.solve_id = s.id), '[]'::jsonb) as analysis_runs
from public.solves s;
grant select on public.solve_details to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('solve-videos', 'solve-videos', false, 1073741824, array['video/webm','video/mp4','video/quicktime'])
on conflict (id) do update set public = false;

-- Object keys must be: <auth-user-uuid>/<solve-uuid>/<filename>.
create policy solve_video_owner_select on storage.objects for select to authenticated
using (bucket_id = 'solve-videos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy solve_video_owner_insert on storage.objects for insert to authenticated
with check (bucket_id = 'solve-videos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy solve_video_owner_update on storage.objects for update to authenticated
using (bucket_id = 'solve-videos' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'solve-videos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy solve_video_owner_delete on storage.objects for delete to authenticated
using (bucket_id = 'solve-videos' and (storage.foldername(name))[1] = auth.uid()::text);

