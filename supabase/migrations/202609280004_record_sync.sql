-- Local-first, record-level BlindSolve sync. Each mutation uploads only the
-- changed settings/pair/solve/attempt records; routine sync remains direct
-- Postgres access through PostgREST/RPC, not an Edge Function.
create table public.bld_sync_records (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('settings','pair','solve','attempt')),
  record_id text not null check (char_length(record_id) between 1 and 200),
  payload jsonb,
  deleted boolean not null default false,
  updated_at timestamptz not null,
  primary key (user_id, kind, record_id),
  constraint sync_payload_shape check (
    (deleted and payload is null) or
    (not deleted and jsonb_typeof(payload) = 'object')
  )
);

create index bld_sync_records_user_updated
  on public.bld_sync_records(user_id, updated_at desc);

create table public.bld_sync_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null default 0 check (revision >= 0),
  updated_at timestamptz not null default now()
);

alter table public.bld_sync_records enable row level security;
alter table public.bld_sync_state enable row level security;
create policy bld_sync_records_owner on public.bld_sync_records
for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy bld_sync_state_owner on public.bld_sync_state
for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update on table public.bld_sync_records to authenticated;
grant select, insert, update on table public.bld_sync_state to authenticated;
revoke truncate, references, trigger on table public.bld_sync_records from anon, authenticated;
revoke truncate, references, trigger on table public.bld_sync_state from anon, authenticated;

-- Preserve any previously synced V2 workspace snapshots during rollout.
insert into public.bld_sync_records(user_id, kind, record_id, payload, updated_at)
select user_id, 'settings', 'settings', data - 'pairs' - 'solves' - 'attempts', updated_at
from public.bld_workspaces;

insert into public.bld_sync_records(user_id, kind, record_id, payload, updated_at)
select w.user_id, 'pair', p.key, p.value, w.updated_at
from public.bld_workspaces w cross join lateral jsonb_each(coalesce(w.data->'pairs','{}'::jsonb)) p;

insert into public.bld_sync_records(user_id, kind, record_id, payload, updated_at)
select w.user_id, 'solve', s.value->>'id', s.value, w.updated_at
from public.bld_workspaces w cross join lateral jsonb_array_elements(coalesce(w.data->'solves','[]'::jsonb)) s
where nullif(s.value->>'id','') is not null;

insert into public.bld_sync_records(user_id, kind, record_id, payload, updated_at)
select w.user_id, 'attempt', a.value->>'id', a.value, w.updated_at
from public.bld_workspaces w cross join lateral jsonb_array_elements(coalesce(w.data->'attempts','[]'::jsonb)) a
where nullif(a.value->>'id','') is not null;

insert into public.bld_sync_state(user_id, revision, updated_at)
select user_id, revision, updated_at from public.bld_workspaces
on conflict (user_id) do nothing;

create or replace function public.get_bld_sync_snapshot()
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select case when auth.uid() is null then
    null
  else jsonb_build_object(
    'revision', coalesce((select revision from public.bld_sync_state where user_id = auth.uid()), 0),
    'records', coalesce((
      select jsonb_agg(jsonb_build_object(
        'kind', kind,
        'record_id', record_id,
        'payload', payload,
        'deleted', deleted,
        'updated_at', updated_at
      ) order by kind, record_id)
      from public.bld_sync_records where user_id = auth.uid()
    ), '[]'::jsonb)
  ) end
$$;

create or replace function public.apply_bld_sync_changes(changes jsonb, expected_revision bigint)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare current_revision bigint;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if expected_revision is null or expected_revision < 0 then
    raise exception 'Invalid expected revision';
  end if;
  if jsonb_typeof(changes) is distinct from 'array'
     or jsonb_array_length(changes) not between 1 and 1000
     or octet_length(changes::text) > 10000000 then
    raise exception 'Invalid sync batch';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(changes) as x(
      kind text, record_id text, payload jsonb, deleted boolean, updated_at timestamptz
    )
    where x.kind not in ('settings','pair','solve','attempt')
       or x.record_id is null or char_length(x.record_id) not between 1 and 200
       or x.deleted is null or x.updated_at is null
       or (x.deleted and x.payload is not null)
       or (not x.deleted and jsonb_typeof(x.payload) is distinct from 'object')
  ) then raise exception 'Invalid sync record'; end if;

  insert into public.bld_sync_state(user_id, revision)
  values (auth.uid(), 0)
  on conflict (user_id) do nothing;
  select revision into current_revision
  from public.bld_sync_state
  where user_id = auth.uid()
  for update;
  if current_revision <> expected_revision then
    raise exception 'Workspace changed on another device'
      using errcode = '40001';
  end if;

  insert into public.bld_sync_records(user_id, kind, record_id, payload, deleted, updated_at)
  select auth.uid(), x.kind, x.record_id, x.payload, x.deleted, x.updated_at
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

revoke all on function public.get_bld_sync_snapshot() from public, anon;
grant execute on function public.get_bld_sync_snapshot() to authenticated;
revoke all on function public.apply_bld_sync_changes(jsonb, bigint) from public, anon;
grant execute on function public.apply_bld_sync_changes(jsonb, bigint) to authenticated;
