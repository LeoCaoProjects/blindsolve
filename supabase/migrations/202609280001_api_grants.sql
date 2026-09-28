-- Minimum API privileges used by the current BlindSolve frontend. The workspace
-- migration already grants its RPC backing table access. These read grants are
-- only for the one-time V1-to-V2 account migration path; RLS still limits every
-- result to auth.uid().
grant select on table
  public.letter_pairs,
  public.letter_pair_aliases,
  public.bld_solves,
  public.lettering_schemes,
  public.sticker_labels
to authenticated;

-- Submission is public. Read/update/delete are granted only to the authenticated
-- API role and then restricted by feedback_admin_* RLS policies.
grant insert on table public.feedback to anon;
grant select, insert, update, delete on table public.feedback to authenticated;

-- feedback_admins intentionally has no direct API grants. Membership is managed
-- only from a trusted database session and exposed as a boolean through
-- is_feedback_admin().
