-- The Edge Function uses the service role to insert validated submissions.
-- RLS bypass does not imply SQL table privileges, so grant only the operation
-- this boundary requires.
grant insert on table public.feedback to service_role;

