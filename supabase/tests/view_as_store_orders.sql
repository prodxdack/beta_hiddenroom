begin;
select plan(5);
select ok(to_regprocedure('public.get_view_as_store_orders(uuid,boolean)') is not null, 'View As Store RPC exists with the expected signature');
select ok(exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'get_view_as_store_orders' and p.prosecdef), 'View As Store RPC is SECURITY DEFINER');
select ok(exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'get_view_as_store_orders' and p.proconfig @> array['search_path=public']), 'View As Store RPC pins search_path');
select ok(has_function_privilege('authenticated', 'public.get_view_as_store_orders(uuid,boolean)', 'execute'), 'Authenticated users can reach the RPC and are checked inside it');
select ok(not has_function_privilege('anon', 'public.get_view_as_store_orders(uuid,boolean)', 'execute'), 'Anonymous users cannot execute the RPC');
select * from finish();
rollback;