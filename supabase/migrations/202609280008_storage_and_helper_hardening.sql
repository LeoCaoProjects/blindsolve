-- Harden dormant solve-video storage before it is exposed by a future client.
-- A video must belong to an existing solve owned by the caller and must use
-- exactly <user-uuid>/<solve-uuid>/<filename>.

update storage.buckets
set file_size_limit = 262144000,
    public = false,
    allowed_mime_types = array['video/webm','video/mp4','video/quicktime']
where id = 'solve-videos';

drop policy if exists solve_video_owner_select on storage.objects;
drop policy if exists solve_video_owner_insert on storage.objects;
drop policy if exists solve_video_owner_update on storage.objects;
drop policy if exists solve_video_owner_delete on storage.objects;

create policy solve_video_owner_select on storage.objects
for select to authenticated
using (
  bucket_id = 'solve-videos'
  and owner_id = auth.uid()::text
  and array_length(storage.foldername(name), 1) = 2
  and (storage.foldername(name))[1] = auth.uid()::text
  and public.owns_solve(((storage.foldername(name))[2])::uuid)
);

create policy solve_video_owner_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'solve-videos'
  and owner_id = auth.uid()::text
  and array_length(storage.foldername(name), 1) = 2
  and (storage.foldername(name))[1] = auth.uid()::text
  and public.owns_solve(((storage.foldername(name))[2])::uuid)
);

create policy solve_video_owner_update on storage.objects
for update to authenticated
using (
  bucket_id = 'solve-videos'
  and owner_id = auth.uid()::text
  and array_length(storage.foldername(name), 1) = 2
  and (storage.foldername(name))[1] = auth.uid()::text
  and public.owns_solve(((storage.foldername(name))[2])::uuid)
)
with check (
  bucket_id = 'solve-videos'
  and owner_id = auth.uid()::text
  and array_length(storage.foldername(name), 1) = 2
  and (storage.foldername(name))[1] = auth.uid()::text
  and public.owns_solve(((storage.foldername(name))[2])::uuid)
);

create policy solve_video_owner_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'solve-videos'
  and owner_id = auth.uid()::text
  and array_length(storage.foldername(name), 1) = 2
  and (storage.foldername(name))[1] = auth.uid()::text
  and public.owns_solve(((storage.foldername(name))[2])::uuid)
);

-- SECURITY DEFINER ownership helpers are not public APIs for anonymous users.
revoke all on function public.owns_solve(uuid) from public, anon;
revoke all on function public.owns_analysis(uuid) from public, anon;
grant execute on function public.owns_solve(uuid), public.owns_analysis(uuid) to authenticated;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

