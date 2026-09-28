-- Durable application-level abuse limits for public WCA OAuth traffic and
-- authenticated record sync. These complement Supabase gateway/platform
-- controls; they are not frontend throttles.

create table public.edge_rate_limits (
  scope text not null check (scope in ('wca-start', 'wca-callback')),
  fingerprint text not null check (fingerprint ~ '^[0-9a-f]{64}$'),
  window_started_at timestamptz not null default now(),
  request_count integer not null default 1 check (request_count > 0),
  updated_at timestamptz not null default now(),
  primary key (scope, fingerprint)
);

alter table public.edge_rate_limits enable row level security;
revoke all on table public.edge_rate_limits from public, anon, authenticated;

create or replace function public.consume_edge_rate_limit(
  p_scope text,
  p_fingerprint text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  accepted boolean;
  request_limit integer;
begin
  if p_scope not in ('wca-start', 'wca-callback')
     or p_fingerprint is null
     or p_fingerprint !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid rate-limit input' using errcode = '22023';
  end if;

  request_limit := case when p_scope = 'wca-start' then 30 else 15 end;

  insert into public.edge_rate_limits as limits(
    scope, fingerprint, window_started_at, request_count, updated_at
  ) values (p_scope, p_fingerprint, now(), 1, now())
  on conflict (scope, fingerprint) do update
    set window_started_at = case
          when limits.window_started_at <= now() - interval '10 minutes' then now()
          else limits.window_started_at
        end,
        request_count = case
          when limits.window_started_at <= now() - interval '10 minutes' then 1
          else least(limits.request_count + 1, request_limit + 1)
        end,
        updated_at = now()
  returning request_count <= request_limit into accepted;

  return accepted;
end;
$$;

revoke all on function public.consume_edge_rate_limit(text, text) from public, anon, authenticated;
grant execute on function public.consume_edge_rate_limit(text, text) to service_role;

create table public.bld_sync_rate_limits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 1 check (request_count > 0),
  updated_at timestamptz not null default now()
);

alter table public.bld_sync_rate_limits enable row level security;
revoke all on table public.bld_sync_rate_limits from public, anon, authenticated;

create or replace function public.apply_bld_sync_changes(changes jsonb, expected_revision bigint)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_revision bigint;
  sync_requests integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if expected_revision is null or expected_revision < 0 then
    raise exception 'Invalid expected revision' using errcode = '22023';
  end if;
  if jsonb_typeof(changes) is distinct from 'array'
     or jsonb_array_length(changes) not between 1 and 1000
     or octet_length(changes::text) > 5000000 then
    raise exception 'Invalid sync batch' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(changes) as x(
      kind text, record_id text, payload jsonb, deleted boolean, updated_at timestamptz
    )
    where x.kind not in ('settings','pair','solve','attempt')
       or x.record_id is null or char_length(x.record_id) not between 1 and 200
       or x.deleted is null or x.updated_at is null
       or x.updated_at > now() + interval '10 minutes'
       or (x.deleted and x.payload is not null)
       or (not x.deleted and jsonb_typeof(x.payload) is distinct from 'object')
       or (x.kind = 'settings' and (x.record_id <> 'settings' or x.deleted))
       or (x.kind = 'settings' and not x.deleted and octet_length(x.payload::text) > 262144)
       or (x.kind = 'pair' and not x.deleted and octet_length(x.payload::text) > 32768)
       or (x.kind = 'solve' and (
            x.record_id !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
            or (not x.deleted and (
              octet_length(x.payload::text) > 524288
              or x.payload->>'id' is distinct from x.record_id
            ))
          ))
       or (x.kind = 'attempt' and (
            x.record_id !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
            or (not x.deleted and (
              octet_length(x.payload::text) > 65536
              or x.payload->>'id' is distinct from x.record_id
            ))
          ))
  ) then
    raise exception 'Invalid sync record' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(changes) as x(kind text, record_id text)
    group by x.kind, x.record_id
    having count(*) > 1
  ) then
    raise exception 'Duplicate sync record' using errcode = '22023';
  end if;

  insert into public.bld_sync_rate_limits as limits(
    user_id, window_started_at, request_count, updated_at
  ) values (auth.uid(), now(), 1, now())
  on conflict (user_id) do update
    set window_started_at = case
          when limits.window_started_at <= now() - interval '5 minutes' then now()
          else limits.window_started_at
        end,
        request_count = case
          when limits.window_started_at <= now() - interval '5 minutes' then 1
          else least(limits.request_count + 1, 121)
        end,
        updated_at = now()
  returning request_count into sync_requests;

  if sync_requests > 120 then
    raise exception 'Sync rate limit exceeded' using errcode = 'P0001';
  end if;

  insert into public.bld_sync_state(user_id, revision)
  values (auth.uid(), 0)
  on conflict (user_id) do nothing;

  select revision into current_revision
  from public.bld_sync_state
  where user_id = auth.uid()
  for update;

  if current_revision <> expected_revision then
    raise exception 'Workspace changed on another device' using errcode = '40001';
  end if;

  insert into public.bld_sync_records(user_id, kind, record_id, payload, deleted, updated_at)
  select auth.uid(), x.kind, x.record_id, x.payload, x.deleted, now()
  from jsonb_to_recordset(changes) as x(
    kind text, record_id text, payload jsonb, deleted boolean, updated_at timestamptz
  )
  on conflict (user_id, kind, record_id) do update
    set payload = excluded.payload,
        deleted = excluded.deleted,
        updated_at = excluded.updated_at;

  update public.bld_sync_state
  set revision = revision + 1, updated_at = now()
  where user_id = auth.uid()
  returning revision into current_revision;

  return current_revision;
end;
$$;

revoke all on function public.apply_bld_sync_changes(jsonb, bigint) from public, anon;
grant execute on function public.apply_bld_sync_changes(jsonb, bigint) to authenticated;

-- Rate-limit rows are operational metadata, not user-readable application data.
revoke all on table public.edge_rate_limits, public.bld_sync_rate_limits from public, anon, authenticated;
