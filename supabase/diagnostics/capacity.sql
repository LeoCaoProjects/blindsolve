-- Read-only: run manually in the authorized project's SQL editor.
begin transaction read only;
select now() as checked_at, pg_database_size(current_database()) as database_bytes,
       pg_size_pretty(pg_database_size(current_database())) as database_size;
select count(*) as total_records,
       count(*) filter (where deleted) as tombstones,
       count(*) filter (where not deleted and coalesce(payload->>'deleted','false')='true') as legacy_soft_deleted,
       count(*) filter (where not deleted and coalesce(payload->>'deleted','false')<>'true') as active_records
from public.bld_sync_records;
select kind, deleted, count(*) as records,
       round(avg(pg_column_size(r))) as average_row_probe_bytes
from public.bld_sync_records r group by kind, deleted order by kind, deleted;
select schemaname, relname, pg_table_size(relid) as table_bytes,
       pg_indexes_size(relid) as index_bytes, pg_total_relation_size(relid) as total_bytes,
       n_live_tup as estimated_live_tuples, n_dead_tup as estimated_dead_tuples, last_autovacuum
from pg_stat_user_tables where schemaname in ('public','auth','storage')
order by pg_total_relation_size(relid) desc limit 15;
rollback;
