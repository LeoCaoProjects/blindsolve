-- Run only against the dedicated local Supabase test database: supabase test db.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);
insert into auth.users(id) values
 ('00000000-0000-4000-8000-000000000001'),
 ('00000000-0000-4000-8000-000000000002');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}';
select is(public.save_bld_workspace('{"scheme":{},"pairs":{},"solves":[],"attempts":[]}'::jsonb,0),1::bigint,'first write is revision 1');
select is((public.get_bld_workspace()->>'revision')::bigint,1::bigint,'owner can read snapshot');
select throws_ok($$select public.save_bld_workspace('{"scheme":{},"pairs":{},"solves":[],"attempts":[]}'::jsonb,0)$$,'40001','Workspace changed elsewhere. Retry sync to merge changes.','stale writes fail');
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}';
select is((select count(*) from public.bld_workspaces),0::bigint,'other account cannot read owner row');
select is((public.get_bld_workspace()->>'revision')::bigint,0::bigint,'new account sees no snapshot');
select throws_ok($$insert into public.bld_workspaces(user_id,data) values('00000000-0000-4000-8000-000000000001','{}')$$,'42501',null,'cannot write another owner');
select * from finish();
rollback;
