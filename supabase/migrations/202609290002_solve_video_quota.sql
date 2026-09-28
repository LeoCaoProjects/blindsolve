-- Bound aggregate solve-video storage per authenticated account before the
-- dormant uploader is enabled. Per-object bucket limits still apply.

create or replace function public.can_store_solve_video(
  p_name text,
  p_size bigint,
  p_object_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and p_name is not null
    and char_length(p_name) <= 500
    and p_size between 1 and 262144000
    and array_length(storage.foldername(p_name), 1) = 2
    and (storage.foldername(p_name))[1] = auth.uid()::text
    and public.owns_solve(((storage.foldername(p_name))[2])::uuid)
    and (
      select count(*) < 100
        and coalesce(sum(coalesce((o.metadata->>'size')::bigint, 0)), 0) + p_size <= 2147483648
      from storage.objects o
      where o.bucket_id = 'solve-videos'
        and o.owner_id = auth.uid()::text
        and o.id is distinct from p_object_id
    );
$$;

revoke all on function public.can_store_solve_video(text, bigint, uuid) from public, anon;
grant execute on function public.can_store_solve_video(text, bigint, uuid) to authenticated;

drop policy if exists solve_video_owner_insert on storage.objects;
create policy solve_video_owner_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'solve-videos'
  and owner_id = auth.uid()::text
  and public.can_store_solve_video(
    name,
    coalesce((metadata->>'size')::bigint, 0),
    id
  )
);

drop policy if exists solve_video_owner_update on storage.objects;
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
  and public.can_store_solve_video(
    name,
    coalesce((metadata->>'size')::bigint, 0),
    id
  )
);
