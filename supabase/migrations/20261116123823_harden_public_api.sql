-- No user-data rewrites. Public feedback submission remains behind the service-only
-- Edge Function; anonymous clients need no direct application-table privileges.
revoke all on table
  public.profiles, public.solves, public.analysis_runs, public.frame_observations,
  public.timeline_events, public.stage_metrics, public.solve_details,
  public.lettering_schemes, public.sticker_labels, public.letter_pairs,
  public.letter_pair_aliases, public.bld_solves, public.practice_attempts,
  public.bld_workspaces, public.bld_sync_records, public.bld_sync_state,
  public.feedback, public.feedback_admins,
  public.feedback_submission_limits, public.edge_rate_limits, public.bld_sync_rate_limits
from public, anon;

revoke all on public.feedback_admins from authenticated;

-- Trigger functions are internal entry points, not browser RPCs.
revoke all on function public.create_profile_for_new_user(),
  public.touch_updated_at(), public.touch_feedback_updated_at()
from public, anon, authenticated;

create or replace function public.touch_feedback_updated_at() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;

-- One live authorization boundary for Overview, Feedback and its attachments.
-- Membership is trusted database state, never user-editable JWT metadata.
create or replace function public.is_feedback_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.feedback_admins a
    join auth.users u on u.id = a.user_id
    join auth.sessions s on s.user_id = u.id
    where a.user_id = auth.uid() and not coalesce(u.is_anonymous, false)
      and u.deleted_at is null and (u.banned_until is null or u.banned_until <= now())
      and s.id::text = auth.jwt()->>'session_id'
      and (s.not_after is null or s.not_after > now())
  );
$$;
revoke all on function public.is_feedback_admin() from public, anon;
grant execute on function public.is_feedback_admin() to authenticated;
