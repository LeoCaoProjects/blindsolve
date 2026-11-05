-- Dedicated LOCAL test database only. Never use --remote/production credentials.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
insert into auth.users(id) values
 ('00000000-0000-4000-8000-000000000001'),
 ('00000000-0000-4000-8000-000000000002');
create function pg_temp.batch(k text, id text, payload jsonb, deleted boolean default false)
returns jsonb language sql as $$
  select jsonb_build_array(jsonb_build_object('kind', k, 'record_id', id,
    'payload', payload, 'deleted', deleted, 'updated_at', now()));
$$;
select ok(not has_function_privilege('anon', 'public.apply_bld_sync_changes(jsonb,bigint)', 'execute'), 'anonymous sync writes denied');
select ok(not has_function_privilege('authenticated', 'public.apply_bld_sync_changes_unserialized(jsonb,bigint)', 'execute'), 'private write implementation cannot bypass wrapper');
select ok(not has_function_privilege('authenticated', 'public.save_bld_workspace(jsonb,bigint)', 'execute'), 'legacy write endpoint remains revoked');
select ok(not has_table_privilege('authenticated', 'public.bld_sync_records', 'insert,update,delete'), 'direct sync mutations denied');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}';
select is(public.apply_bld_sync_changes(pg_temp.batch('settings','settings','{"scheme":{"name":"Personal"}}'),0),1::bigint,'first settings write advances revision');
select is(public.apply_bld_sync_changes(pg_temp.batch('attempt','10000000-0000-4000-8000-000000000001','{"id":"10000000-0000-4000-8000-000000000001","kind":"memo"}'),1),2::bigint,'incremental attempt write advances revision');
select is((select payload->'scheme'->>'name' from public.bld_sync_records where kind='settings'),'Personal','incremental write preserves unrelated settings');
select is(jsonb_array_length(public.get_bld_sync_snapshot()->'records'),2,'hydration returns all owner records');
select is((public.get_bld_sync_snapshot()->>'revision')::bigint,2::bigint,'hydration includes concurrency revision');
select is(public.apply_bld_sync_changes(pg_temp.batch('attempt','10000000-0000-4000-8000-000000000001','{"id":"10000000-0000-4000-8000-000000000001","kind":"memo"}'),0),2::bigint,'stale identical retry is a no-op');
select throws_ok($$select public.apply_bld_sync_changes(pg_temp.batch('settings','settings','{"scheme":{"name":"Stale"}}'),0)$$,'40001','Workspace changed on another device','divergent stale writes rejected');
reset role;
select is((select request_count from public.bld_sync_rate_limits where user_id='00000000-0000-4000-8000-000000000001'),2,'identical retries do not consume write quota');
set local role authenticated;
select is(public.apply_bld_sync_changes(pg_temp.batch('attempt','10000000-0000-4000-8000-000000000001',null,true),2),3::bigint,'deleting existing history advances revision');
select ok((select deleted and payload is null from public.bld_sync_records where kind='attempt'),'tombstone discards payload');
select is(public.apply_bld_sync_changes(pg_temp.batch('attempt','10000000-0000-4000-8000-000000000002',null,true),3),4::bigint,'delete-before-insert creates durable negative record');
select is(public.apply_bld_sync_changes(pg_temp.batch('attempt','10000000-0000-4000-8000-000000000001','{"id":"10000000-0000-4000-8000-000000000001"}'),4),4::bigint,'current-revision stale queue cannot resurrect history');
select is(public.apply_bld_sync_changes(pg_temp.batch('attempt','10000000-0000-4000-8000-000000000002','{"id":"10000000-0000-4000-8000-000000000002"}'),0),4::bigint,'old offline queue cannot resurrect delete-before-insert ID');
select is((select count(*) from jsonb_array_elements(public.get_bld_sync_snapshot()->'records') r where (r->>'deleted')::boolean),2::bigint,'hydration includes deletion markers');
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}';
select is(jsonb_array_length(public.get_bld_sync_snapshot()->'records'),0,'other owner cannot hydrate Alice records');
select is((select count(*) from public.bld_sync_records),0::bigint,'RLS hides other owner rows');
select is(public.apply_bld_sync_changes(pg_temp.batch('attempt','10000000-0000-4000-8000-000000000001','{"id":"10000000-0000-4000-8000-000000000001"}'),0),1::bigint,'same ID is independently owner scoped');
select throws_ok($$insert into public.bld_sync_records(user_id,kind,record_id,payload) values('00000000-0000-4000-8000-000000000001','pair','AB','{}')$$,'42501',null,'direct cross-owner writes denied');
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}';
select ok((select deleted from public.bld_sync_records where kind='attempt' and record_id='10000000-0000-4000-8000-000000000001'),'other owner write did not alter tombstone');
select is(public.apply_bld_sync_changes(pg_temp.batch('solve','20000000-0000-4000-8000-000000000001','{"id":"20000000-0000-4000-8000-000000000001","deleted":true}'),4),5::bigint,'legacy soft-deleted solve accepted');
select is(public.apply_bld_sync_changes(pg_temp.batch('solve','20000000-0000-4000-8000-000000000001','{"id":"20000000-0000-4000-8000-000000000001"}'),5),5::bigint,'legacy soft-deletion cannot be overwritten');
reset role;
update public.bld_sync_rate_limits set request_count=120 where user_id='00000000-0000-4000-8000-000000000001';
set local role authenticated;
select is(public.apply_bld_sync_changes(pg_temp.batch('settings','settings','{"scheme":{"name":"Personal"}}'),5),5::bigint,'no-op succeeds even at rate allowance');
select throws_ok($$select public.apply_bld_sync_changes(pg_temp.batch('settings','settings','{"scheme":{"name":"Rate limited"}}'),5)$$,'P0001','Sync rate limit exceeded','changed batches remain rate limited');
select is((public.get_bld_sync_snapshot()->>'revision')::bigint,5::bigint,'rejected batch does not advance revision');
select * from finish();
rollback;
