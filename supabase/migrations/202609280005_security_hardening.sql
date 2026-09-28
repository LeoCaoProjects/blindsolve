-- Pre-production hardening for the local-first sync boundary and feedback data.
-- Clients may read their own sync rows, but every write must pass through the
-- revision-checked RPC below. The function fixes user_id to auth.uid().

create or replace function public.apply_bld_sync_changes(changes jsonb, expected_revision bigint)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_revision bigint;
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

  if current_revision <> expected_revision then
    raise exception 'Workspace changed on another device' using errcode = '40001';
  end if;

  insert into public.bld_sync_records(user_id, kind, record_id, payload, deleted, updated_at)
  select auth.uid(), x.kind, x.record_id, x.payload, x.deleted, now()
  from jsonb_to_recordset(changes) as x(
    kind text, record_id text, payload jsonb, deleted boolean, updated_at timestamptz
  )
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

revoke all on function public.apply_bld_sync_changes(jsonb, bigint) from public, anon;
grant execute on function public.apply_bld_sync_changes(jsonb, bigint) to authenticated;

-- Prevent direct writes that bypass optimistic concurrency and validation.
revoke insert, update, delete on table public.bld_sync_records from authenticated;
revoke insert, update, delete on table public.bld_sync_state from authenticated;
grant select on table public.bld_sync_records, public.bld_sync_state to authenticated;

-- The old whole-workspace API remains readable only for the one-time V1
-- fallback. New writes exclusively use the record-level API above.
revoke insert, update, delete on table public.bld_workspaces from authenticated;
revoke execute on function public.save_bld_workspace(jsonb, bigint) from authenticated;
grant select on table public.bld_workspaces to authenticated;

-- Harden the admin helper against search-path substitution.
create or replace function public.is_feedback_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.feedback_admins where user_id = auth.uid()
  );
$$;
revoke all on function public.is_feedback_admin() from public, anon;
grant execute on function public.is_feedback_admin() to authenticated;

-- Bound every user-controlled feedback field. These checks limit accidental
-- and malicious row amplification even when the public submission API is used.
alter table public.feedback
  add constraint feedback_contact_email_size check (contact_email is null or char_length(contact_email) <= 320),
  add constraint feedback_source_page_size check (char_length(source_page) between 1 and 500),
  add constraint feedback_context_size check (technical_context is null or octet_length(technical_context::text) <= 32768),
  add constraint feedback_screenshot_path_size check (screenshot_path is null or char_length(screenshot_path) <= 500),
  add constraint feedback_screenshot_name_size check (screenshot_name is null or char_length(screenshot_name) <= 255),
  add constraint feedback_submitter_name_size check (submitter_name is null or char_length(submitter_name) <= 200),
  add constraint feedback_submitter_detail_size check (submitter_detail is null or char_length(submitter_detail) <= 320),
  add constraint feedback_admin_note_size check (admin_note is null or char_length(admin_note) <= 10000);

-- Only accept the path shape generated by the client. This is not a rate
-- limiter; anonymous upload abuse is called out separately in the audit.
drop policy if exists feedback_screenshot_create on storage.objects;
create policy feedback_screenshot_create on storage.objects
for insert to anon, authenticated
with check (
  bucket_id = 'feedback-screenshots'
  and array_length(storage.foldername(name), 1) = 1
  and (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
  and char_length(name) <= 500
);
