-- Keep a stale or duplicated client from occupying the entire PostgREST pool.
-- The existing implementation remains the validation/write boundary; this
-- wrapper adds a non-blocking per-user gate and makes acknowledged retries
-- idempotent.

alter function public.apply_bld_sync_changes(jsonb, bigint)
  rename to apply_bld_sync_changes_unserialized;

revoke all on function public.apply_bld_sync_changes_unserialized(jsonb, bigint)
  from public, anon, authenticated;

create function public.apply_bld_sync_changes(changes jsonb, expected_revision bigint)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_revision bigint;
  already_applied boolean;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  -- Do not queue competing requests while holding scarce PostgREST database
  -- connections. Existing clients treat 55P03 as a bounded ordinary failure,
  -- instead of the unbounded revision-conflict retry path.
  if not pg_catalog.pg_try_advisory_xact_lock(
    pg_catalog.hashtextextended(auth.uid()::text, 0)
  ) then
    raise exception 'Sync already in progress' using errcode = '55P03';
  end if;

  begin
    return public.apply_bld_sync_changes_unserialized(changes, expected_revision);
  exception
    when serialization_failure then
      select revision into current_revision
      from public.bld_sync_state
      where user_id = auth.uid();

      select not exists (
        select 1
        from jsonb_to_recordset(changes) as x(
          kind text,
          record_id text,
          payload jsonb,
          deleted boolean,
          updated_at timestamptz
        )
        left join public.bld_sync_records r
          on r.user_id = auth.uid()
         and r.kind = x.kind
         and r.record_id = x.record_id
        where r.user_id is null
           or r.deleted is distinct from x.deleted
           or r.payload is distinct from x.payload
      ) into already_applied;

      -- A response can be lost after commit. Returning the current revision for
      -- the exact stored payload lets that retry clear its local pending queue.
      if already_applied then
        return current_revision;
      end if;
      raise;
  end;
end;
$$;

revoke all on function public.apply_bld_sync_changes(jsonb, bigint)
  from public, anon;
grant execute on function public.apply_bld_sync_changes(jsonb, bigint)
  to authenticated;
