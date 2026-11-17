-- Read-only Admin aggregation of existing Auth and canonical cloud records.
-- No telemetry, new data tables, or changes to sync/deletion semantics.
-- The existing helper is the only supported membership API. RLS already hides
-- these rows; revoke default table grants as an additional privilege boundary.
revoke all on public.feedback_admins from public, anon, authenticated;

create schema if not exists admin_private;
revoke all on schema admin_private from public, anon, authenticated;

-- Legacy/imported JSON can contain invalid dates. Never substitute sync time for
-- a completion date. Explicit timezone required; infinity/relative dates rejected.
create function admin_private.record_date(value text) returns timestamptz
language plpgsql immutable security invoker set search_path = '' as $$
begin
  if value is null or length(value) > 40
     or value !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$' then
    return null;
  end if;
  return value::timestamptz;
exception when invalid_datetime_format or datetime_field_overflow
  or invalid_time_zone_displacement_value then
  return null;
end;
$$;
revoke all on function admin_private.record_date(text) from public, anon, authenticated;

create function public.admin_overview(period text default '7d') returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  cutoff timestamptz;
  observed_at timestamptz := now();
  report jsonb;
begin
  if auth.uid() is null or not public.is_feedback_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  cutoff := case period
    when '24h' then observed_at - interval '24 hours'
    when '7d' then observed_at - interval '7 days'
    when '30d' then observed_at - interval '30 days'
    when 'all' then '-infinity'::timestamptz
    else null end;
  if cutoff is null then raise exception 'Invalid period' using errcode = '22023'; end if;

  with records as materialized (
    select r.user_id, r.kind, r.updated_at, r.deleted, r.payload
    from public.bld_sync_records r
    join auth.users u on u.id = r.user_id
    where not coalesce(u.is_anonymous, false)
  ), history as materialized (
    select user_id, kind, admin_private.record_date(payload->>'createdAt') as completed_at,
      case when payload->>'trainingMode' in ('exec','guided','recall','trace','recognition')
        then payload->>'trainingMode' else 'legacy' end as mode
    from records
    where not deleted and coalesce(payload->>'deleted','false') <> 'true'
      and ((kind = 'solve' and payload->>'result' in ('success','+2','dnf'))
        or (kind = 'attempt' and payload->>'kind' = 'memo'
          and (payload->>'trainingMode' is null or payload->>'trainingMode' in
            ('exec','guided','recall','trace','recognition','full'))))
  ), selected as materialized (
    select * from history where completed_at >= cutoff and completed_at <= observed_at
  ), accounts as materialized (
    select created_at from auth.users where not coalesce(is_anonymous,false)
  ), days as (
    select (created_at at time zone 'UTC')::date as day, 1 as accounts, 0 as solves, 0 as training
    from accounts where created_at >= cutoff and created_at <= observed_at
    union all
    select (completed_at at time zone 'UTC')::date, 0,
      case when kind = 'solve' then 1 else 0 end,
      case when kind = 'attempt' then 1 else 0 end from selected
  ), daily as (
    select day, sum(accounts) as accounts, sum(solves) as solves, sum(training) as training
    from days group by day
  )
  select jsonb_build_object(
    'updatedAt', observed_at,
    'since', case when period = 'all' then null else cutoff end,
    'registeredAccounts', (select count(*) from accounts),
    'newAccounts', (select count(*) from accounts where created_at >= cutoff and created_at <= observed_at),
    'activeUsers', (select count(distinct user_id) from records where updated_at >= cutoff and updated_at <= observed_at),
    'solves', (select count(*) from selected where kind = 'solve'),
    'training', (select count(*) from selected where kind = 'attempt'),
    'undatedSolves', (select count(*) from history where kind = 'solve' and (completed_at is null or completed_at > observed_at)),
    'undatedTraining', (select count(*) from history where kind = 'attempt' and (completed_at is null or completed_at > observed_at)),
    'trend', coalesce((select jsonb_agg(jsonb_build_object('day',day,'accounts',accounts,'solves',solves,'training',training) order by day) from daily),'[]'::jsonb),
    'modes', coalesce((select jsonb_agg(jsonb_build_object('mode',mode,'attempts',attempts) order by attempts desc,mode)
      from (select mode,count(*) as attempts from selected where kind = 'attempt' group by mode) m),'[]'::jsonb),
    'feedback', (select jsonb_build_object(
      'new', count(*) filter(where status = 'new'),
      'open', count(*) filter(where status in ('new','reviewing','planned'))) from public.feedback)
  ) into report;
  return report;
end;
$$;
revoke all on function public.admin_overview(text) from public, anon;
grant execute on function public.admin_overview(text) to authenticated;
