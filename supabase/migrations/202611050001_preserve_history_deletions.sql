-- Preserve deletion intent for immutable history IDs, including stale older clients.
-- No existing data is deleted or rewritten by this migration.
create or replace function public.apply_bld_sync_changes_unserialized(
  changes jsonb,
  expected_revision bigint
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_revision bigint;
  sync_requests integer;
  has_changes boolean;
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

  insert into public.bld_sync_state(user_id, revision)
  values (auth.uid(), 0)
  on conflict (user_id) do nothing;

  select revision into current_revision
  from public.bld_sync_state
  where user_id = auth.uid()
  for update;

  select exists (
    select 1
    from jsonb_to_recordset(changes) as x(
      kind text, record_id text, payload jsonb, deleted boolean, updated_at timestamptz
    )
    left join public.bld_sync_records r
      on r.user_id = auth.uid()
     and r.kind = x.kind
     and r.record_id = x.record_id
    where case
      when x.deleted then r.user_id is null or not r.deleted
      when x.kind in ('solve','attempt') and (r.deleted or coalesce(r.payload->>'deleted','false') = 'true') then false
      else r.user_id is null or r.deleted or r.payload is distinct from x.payload
    end
  ) into has_changes;

  -- Stale identical retries succeed; stale divergent writes still conflict.
  if current_revision <> expected_revision then
    if not has_changes then
      return current_revision;
    end if;
    raise exception 'Workspace changed on another device' using errcode = '40001';
  end if;

  -- No-op batches do not consume limiter allowance or touch stored rows.
  if not has_changes then
    return current_revision;
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

  insert into public.bld_sync_records(user_id, kind, record_id, payload, deleted, updated_at)
  select auth.uid(), x.kind, x.record_id, x.payload, x.deleted, now()
  from jsonb_to_recordset(changes) as x(
    kind text, record_id text, payload jsonb, deleted boolean, updated_at timestamptz
  )
  left join public.bld_sync_records r
    on r.user_id = auth.uid()
   and r.kind = x.kind
   and r.record_id = x.record_id
  where case
    when x.deleted then r.user_id is null or not r.deleted
    when x.kind in ('solve','attempt') and (r.deleted or coalesce(r.payload->>'deleted','false') = 'true') then false
    else r.user_id is null or r.deleted or r.payload is distinct from x.payload
  end
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

revoke all on function public.apply_bld_sync_changes_unserialized(jsonb, bigint)
  from public, anon, authenticated;


create or replace function public.preserve_bld_history_deletion()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if old.kind in ('solve','attempt')
     and (old.deleted or coalesce(old.payload->>'deleted','false') = 'true')
     and not new.deleted then
    return old;
  end if;
  return new;
end;
$$;
revoke all on function public.preserve_bld_history_deletion() from public, anon, authenticated;
drop trigger if exists preserve_bld_history_deletion on public.bld_sync_records;
create trigger preserve_bld_history_deletion before update on public.bld_sync_records
for each row execute function public.preserve_bld_history_deletion();
