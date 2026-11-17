begin;
-- Disposable test database only; rollback restores manual local fixtures too.
truncate auth.users cascade;
truncate public.feedback;
select no_plan();
-- Publication contract: schema knowledge and the public key confer no privilege.
select ok(not exists (
  select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind='r' and not c.relrowsecurity
), 'every public application table has RLS');
select ok(not exists (
  select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind in ('r','v')
    and has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
), 'anonymous role has no direct application table privileges');
select ok(not exists (
  select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname in ('public','admin_private') and p.prosecdef
    and not coalesce(p.proconfig @> array['search_path=""'],false)
), 'privileged functions use a fixed empty search path');
select ok(not has_function_privilege('authenticated','public.create_profile_for_new_user()','execute')
  and not has_function_privilege('authenticated','public.touch_updated_at()','execute')
  and not has_function_privilege('authenticated','public.touch_feedback_updated_at()','execute'),
  'internal trigger functions are not browser entry points');
select ok((select reloptions @> array['security_invoker=true'] from pg_class where oid='public.solve_details'::regclass),
  'solve detail view preserves caller RLS');

insert into auth.users(id,created_at,is_anonymous) values
 ('a0000000-0000-4000-8000-000000000001',now()-interval '60 days',false),
 ('a0000000-0000-4000-8000-000000000002',now()-interval '2 days',false),
 ('a0000000-0000-4000-8000-000000000003',now()-interval '2 hours',false),
 ('a0000000-0000-4000-8000-000000000004',now(),true);
insert into public.feedback_admins(user_id) values('a0000000-0000-4000-8000-000000000001');
insert into auth.sessions(id,user_id) values ('b0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001');
select ok(not has_function_privilege('anon','public.admin_overview(text)','execute'),'guest cannot execute aggregate');
select ok(not has_schema_privilege('authenticated','admin_private','usage'),'private helper schema unavailable');
select ok(not has_function_privilege('authenticated','admin_private.record_date(text)','execute'),'date helper not callable');
select is(admin_private.record_date('2026-11-16T00:00:00+99:99'),null::timestamptz,'invalid timezone cannot crash aggregate');
select is(admin_private.record_date('bad'),null::timestamptz,'invalid date safe');
select is(admin_private.record_date('2026-02-31T00:00:00Z'),null::timestamptz,'invalid calendar date safe');
select is(admin_private.record_date('now'),null::timestamptz,'relative dates not accepted');
set local role authenticated;
set local request.jwt.claims='{"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated"}';
select throws_ok($$select public.admin_overview()$$,'42501','Not authorized','non-admin denied');
set local request.jwt.claims='{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok($$select public.admin_overview()$$,'42501','Not authorized','missing session denied');
set local request.jwt.claims='{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated","session_id":"b0000000-0000-4000-8000-000000000001"}';
select is((public.admin_overview()->>'registeredAccounts')::int,3,'Auth count excludes anonymous users');
select is((public.admin_overview('24h')->>'newAccounts')::int,1,'24h account count');
select is((public.admin_overview('7d')->>'newAccounts')::int,2,'7d account count');
select is((public.admin_overview('all')->>'newAccounts')::int,3,'all account count');
select is((public.admin_overview()->>'solves')::int,0,'empty solves');
select is((public.admin_overview()->>'training')::int,0,'empty training');
select throws_ok($$select public.admin_overview('bogus')$$,'22023','Invalid period','invalid range denied');
reset role;

-- Canonical records, including tombstones and legacy payload deletion markers.
insert into public.bld_sync_records(user_id,kind,record_id,payload,deleted,updated_at)
select 'a0000000-0000-4000-8000-000000000002','solve','s'||n,
  case when n=5 then null else jsonb_build_object('result',case when n=2 then 'dnf' else 'success' end,
    'createdAt',case n when 1 then to_char(now()-interval '2 hours','YYYY-MM-DD"T"HH24:MI:SS"Z"')
      when 2 then to_char(now()-interval '3 days','YYYY-MM-DD"T"HH24:MI:SS"Z"')
      when 3 then to_char(now()-interval '20 days','YYYY-MM-DD"T"HH24:MI:SS"Z"')
      when 4 then to_char(now()-interval '60 days','YYYY-MM-DD"T"HH24:MI:SS"Z"')
      when 7 then 'bad' when 8 then '2999-01-01T00:00:00Z'
      else to_char(now(),'YYYY-MM-DD"T"HH24:MI:SS"Z"') end, 'deleted',n=6) end,
  n=5, now()-interval '1 hour' from generate_series(1,8) n;
insert into public.bld_sync_records(user_id,kind,record_id,payload,updated_at)
select 'a0000000-0000-4000-8000-000000000003','attempt','a'||n,
  jsonb_build_object('kind',case when n=7 then 'flashcard' else 'memo' end,
    'trainingMode',(array['exec','guided','recall','trace','recognition','full',null,'exec'])[n],
    'createdAt',to_char(now()-interval '1 hour','YYYY-MM-DD"T"HH24:MI:SS"Z"'), 'deleted',n=8), now()
from generate_series(1,8) n;
insert into public.bld_sync_records values ('a0000000-0000-4000-8000-000000000003','attempt','tombstone',null,true,now());
insert into public.bld_sync_records values ('a0000000-0000-4000-8000-000000000001','settings','settings','{}',false,now()-interval '20 days');
insert into public.feedback(category,message,status) select 'bug','Synthetic SQL fixture',s::public.feedback_status
from unnest(array['new','reviewing','planned','resolved','archived']) s;
set local role authenticated;
select is(((public.admin_overview('all')->>'solves')::int + (public.admin_overview('all')->>'undatedSolves')::int),6,'total solves excludes both deletion forms');
select is((public.admin_overview('24h')->>'solves')::int,1,'24h uses completion not recent upload');
select is((public.admin_overview('7d')->>'solves')::int,2,'7d includes DNF');
select is((public.admin_overview('30d')->>'solves')::int,3,'30d date clipping');
select is((public.admin_overview('all')->>'solves')::int,4,'all excludes invalid/future completion dates');
select is((public.admin_overview()->>'undatedSolves')::int,2,'invalid/future dates reported separately');
select is((select sum((m->>'attempts')::int) from jsonb_array_elements(public.admin_overview()->'modes') m),6::bigint,'mode totals match completed attempts');
select is((public.admin_overview()->>'training')::int,6,'Training excludes Flashcards and both deletion forms');
select is((public.admin_overview()->>'training')::int,6,'completed attempts in period');
select is((select sum((d->>'training')::int) from jsonb_array_elements(public.admin_overview()->'trend') d),6::bigint,'daily Training totals match completed attempts');
select is(jsonb_array_length(public.admin_overview()->'modes'),6,'five modes plus explicit legacy bucket');
select is((public.admin_overview()->>'activeUsers')::int,2,'recent cloud changes count distinct owners');
select is((public.admin_overview('all')->>'activeUsers')::int,3,'all includes older settings changes');
select is((public.admin_overview()->'feedback'->>'open')::int,3,'open feedback uses actual three statuses');
select is((public.admin_overview()->'feedback'->>'new')::int,1,'new subset');
select ok(not(public.admin_overview()->'feedback' ? 'resolved'),'unused feedback breakdown omitted');
select ok(not(public.admin_overview() ?| array['solvers','trainees','totalSolves','totalTraining']),'unused metric variants omitted');
select is((select sum((d->>'solves')::int) from jsonb_array_elements(public.admin_overview()->'trend') d),2::bigint,'daily solve totals match period');
select is((select sum((d->>'accounts')::int) from jsonb_array_elements(public.admin_overview()->'trend') d),2::bigint,'daily account growth matches period');
select ok(not (public.admin_overview()::text ~ '(a0000000|b0000000|user_id|payload|email|scramble)'),'no raw identities or content in report');
select is((select count(*) from public.bld_sync_records),1::bigint,'Admin browser still reads only own sync records');
select throws_ok($$select * from auth.users$$,'42501',null,'Auth list inaccessible directly');
select throws_ok($$select * from public.feedback_admins$$,'42501',null,'admin grant table inaccessible');
reset role;
update public.bld_sync_records set payload=payload||'{"edited":true}' where record_id='s1';
set local role authenticated;
select is((public.admin_overview()->>'solves')::int,2,'editing record does not add solve');
reset role;
update public.bld_sync_records set deleted=true,payload=null where record_id='s1';
update public.bld_sync_records set deleted=false,payload='{"result":"success"}' where record_id='s1';
set local role authenticated;
select is((public.admin_overview()->>'solves')::int,1,'deleted solve cannot reappear after stale replay');
reset role;
update auth.sessions set not_after=now()-interval '1 second';
set local role authenticated;
select throws_ok($$select public.admin_overview()$$,'42501','Not authorized','expired live session denied');
reset role;
update auth.sessions set not_after=null;
delete from public.feedback_admins;
set local role authenticated;
select throws_ok($$select public.admin_overview()$$,'42501','Not authorized','revoked Admin denied with stale JWT');
select * from finish();
rollback;
