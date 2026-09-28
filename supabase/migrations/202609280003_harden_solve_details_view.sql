-- The solve_details view is created separately from the base tables and inherits
-- the same unused default privileges. Keep its intended authenticated SELECT
-- grant while removing non-query capabilities.
revoke truncate, references, trigger on table public.solve_details from anon, authenticated;
