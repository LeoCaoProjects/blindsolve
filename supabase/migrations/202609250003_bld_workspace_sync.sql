-- Atomic V2 workspace snapshots with optimistic concurrency. Existing V1 tables
-- remain intact for migration/rollback. No SECURITY DEFINER or service key.
create table public.bld_workspaces (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now()
);
alter table public.bld_workspaces enable row level security;
create policy workspace_owner on public.bld_workspaces for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update on public.bld_workspaces to authenticated;

create function public.get_bld_workspace() returns jsonb
language sql security invoker set search_path = '' as $$
  select coalesce((select jsonb_build_object('data', w.data, 'revision', w.revision)
    from public.bld_workspaces w where w.user_id = auth.uid()),
    jsonb_build_object('data', null, 'revision', 0));
$$;

create function public.save_bld_workspace(payload jsonb, expected_revision bigint)
returns bigint language plpgsql security invoker set search_path = '' as $$
declare next_revision bigint;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if jsonb_typeof(payload) is distinct from 'object'
     or jsonb_typeof(payload->'scheme') is distinct from 'object'
     or jsonb_typeof(payload->'pairs') is distinct from 'object'
     or jsonb_typeof(payload->'solves') is distinct from 'array'
     or jsonb_typeof(payload->'attempts') is distinct from 'array'
     or octet_length(payload::text) > 20000000 then
    raise exception 'Invalid workspace payload';
  end if;
  if expected_revision = 0 then
    insert into public.bld_workspaces(user_id, data) values(auth.uid(), payload)
      on conflict do nothing returning revision into next_revision;
  else
    update public.bld_workspaces set data = payload, revision = revision + 1, updated_at = now()
      where user_id = auth.uid() and revision = expected_revision
      returning revision into next_revision;
  end if;
  if next_revision is null then
    raise exception 'Workspace changed elsewhere. Retry sync to merge changes.' using errcode = '40001';
  end if;
  return next_revision;
end;
$$;
revoke all on function public.get_bld_workspace() from public, anon;
revoke all on function public.save_bld_workspace(jsonb,bigint) from public, anon;
grant execute on function public.get_bld_workspace() to authenticated;
grant execute on function public.save_bld_workspace(jsonb,bigint) to authenticated;
