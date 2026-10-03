-- Beat license delivery asset contract; synthetic fixtures only.
-- Run after 20261002180000_require_beat_license_delivery_assets.sql.
begin;
select plan(10);

select has_column('public', 'store_products', 'beat_original_path', 'protected WAV path exists');
select has_column('public', 'store_products', 'beat_mp3_path', 'protected MP3 path exists');
select has_column('public', 'store_products', 'beat_stems_path', 'protected stems path exists');
select has_function('public', 'validate_beat_license_assignment', array[]::text[], 'delivery validation trigger function exists');
select ok(exists (select 1 from pg_trigger where tgname = 'beat_license_assignments_validate'), 'assignment validation trigger exists');
select ok(exists (select 1 from pg_trigger where tgname = 'reconcile_beat_license_assignments_for_delivery'), 'delivery reconciliation trigger exists');

delete from public.store_products where id = '00000000-0000-4000-8000-00000000d001';
delete from public.beat_licenses where id in (
  '00000000-0000-4000-8000-00000000d101',
  '00000000-0000-4000-8000-00000000d102',
  '00000000-0000-4000-8000-00000000d103'
);

insert into public.store_products (
  id, slug, name, description, category, price, currency, is_digital, is_active,
  publication_status, beat_original_path, beat_mp3_path, beat_stems_path
) values (
  '00000000-0000-4000-8000-00000000d001', 'synthetic-delivery-assets', 'Synthetic delivery assets',
  'Synthetic beat', 'beats', 0, 'MXN', true, false, 'draft',
  'masters/synthetic.wav', 'previews/synthetic.mp3', 'stems/synthetic.zip'
);

insert into public.beat_licenses (id, name, min_price, max_price, description, unlimited_streams, format)
values
  ('00000000-0000-4000-8000-00000000d101', 'Synthetic WAV', 1, 1, 'Synthetic WAV license', true, 'WAV'),
  ('00000000-0000-4000-8000-00000000d102', 'Synthetic MP3', 1, 1, 'Synthetic MP3 license', true, 'MP3'),
  ('00000000-0000-4000-8000-00000000d103', 'Synthetic Stems', 1, 1, 'Synthetic stems license', true, 'Stems');

update public.store_products
set beat_original_path = null
where id = '00000000-0000-4000-8000-00000000d001';

select throws_ok(
  $$insert into public.beat_license_assignments (beat_id, license_id, price, is_enabled)
    values ('00000000-0000-4000-8000-00000000d001', '00000000-0000-4000-8000-00000000d101', 1, true)$$,
  'P0001', null, 'WAV license cannot be enabled without a WAV master'
);

select throws_ok(
  $$insert into public.beat_license_assignments (beat_id, license_id, price, is_enabled)
    values ('00000000-0000-4000-8000-00000000d001', '00000000-0000-4000-8000-00000000d102', 1, true)$$,
  'P0001', null, 'MP3 license cannot be enabled without an MP3 delivery file'
);

select throws_ok(
  $$insert into public.beat_license_assignments (beat_id, license_id, price, is_enabled)
    values ('00000000-0000-4000-8000-00000000d001', '00000000-0000-4000-8000-00000000d103', 1, true)$$,
  'P0001', null, 'Stems license cannot be enabled without a stems ZIP'
);

update public.store_products
set beat_original_path = 'masters/synthetic.wav'
where id = '00000000-0000-4000-8000-00000000d001';
insert into public.beat_license_assignments (beat_id, license_id, price, is_enabled)
values ('00000000-0000-4000-8000-00000000d001', '00000000-0000-4000-8000-00000000d101', 1, true);
update public.store_products
set beat_original_path = null
where id = '00000000-0000-4000-8000-00000000d001';
select is(
  (select is_enabled from public.beat_license_assignments where beat_id = '00000000-0000-4000-8000-00000000d001' and license_id = '00000000-0000-4000-8000-00000000d101'),
  false,
  'removing the WAV disables an active WAV license'
);

select * from finish();
rollback;
