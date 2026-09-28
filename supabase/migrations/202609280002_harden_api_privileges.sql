-- Supabase's project defaults grant TRUNCATE, REFERENCES and TRIGGER on new
-- public tables. BlindSolve does not use those privileges, and TRUNCATE is not
-- row-scoped by RLS. Revoke only those unused capabilities from the exact
-- tables created by this repository; retain the explicit API grants from the
-- preceding migrations.
revoke truncate, references, trigger on table
  public.profiles,
  public.solves,
  public.analysis_runs,
  public.frame_observations,
  public.timeline_events,
  public.stage_metrics,
  public.lettering_schemes,
  public.sticker_labels,
  public.letter_pairs,
  public.letter_pair_aliases,
  public.bld_solves,
  public.practice_attempts,
  public.bld_workspaces,
  public.feedback,
  public.feedback_admins
from anon, authenticated;
