set lock_timeout = '5s';
set statement_timeout = '60s';

-- A license may be enabled only when its normalized delivery format has a
-- corresponding protected file on the beat.
create or replace function public.validate_beat_license_assignment()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  license_row public.beat_licenses%rowtype;
  beat_row public.store_products%rowtype;
  license_format text;
begin
  select * into license_row
  from public.beat_licenses
  where id = new.license_id;
  if not found then
    raise exception 'License not found';
  end if;

  select * into beat_row
  from public.store_products
  where id = new.beat_id;
  if not found or beat_row.category is distinct from 'beats' then
    raise exception 'License assignments are only available for beat products';
  end if;

  if new.price < license_row.min_price or new.price > license_row.max_price then
    raise exception 'License price is outside allowed range';
  end if;

  if coalesce(new.is_enabled, false) then
    license_format := lower(btrim(coalesce(license_row.format, '')));
    if license_format like '%wav%'
       and lower(btrim(coalesce(beat_row.beat_original_path, ''))) not like '%.wav' then
      raise exception 'A WAV license requires a protected WAV master for this beat';
    end if;
    if license_format like '%mp3%'
       and lower(btrim(coalesce(beat_row.beat_mp3_path, ''))) not like '%.mp3' then
      raise exception 'An MP3 license requires a protected MP3 delivery file for this beat';
    end if;
    if license_format like '%stem%'
       and lower(btrim(coalesce(beat_row.beat_stems_path, ''))) not like '%.zip' then
      raise exception 'A Stems license requires protected stems for this beat';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists beat_license_assignments_validate on public.beat_license_assignments;
create trigger beat_license_assignments_validate
before insert or update on public.beat_license_assignments
for each row execute function public.validate_beat_license_assignment();

-- Repair existing active assignments created before the delivery requirement.
update public.beat_license_assignments assignments
set is_enabled = false
from public.beat_licenses licenses, public.store_products products
where assignments.license_id = licenses.id
  and products.id = assignments.beat_id
  and assignments.is_enabled = true
  and (
    (lower(btrim(coalesce(licenses.format, ''))) like '%wav%'
      and lower(btrim(coalesce(products.beat_original_path, ''))) not like '%.wav')
    or (lower(btrim(coalesce(licenses.format, ''))) like '%mp3%'
      and lower(btrim(coalesce(products.beat_mp3_path, ''))) not like '%.mp3')
    or (lower(btrim(coalesce(licenses.format, ''))) like '%stem%'
      and lower(btrim(coalesce(products.beat_stems_path, ''))) not like '%.zip')
  );

-- If a protected delivery file is removed later, disable only the affected
-- format. Uploading a replacement file never auto-enables a license.
create or replace function public.reconcile_beat_license_assignments_for_delivery()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.category = 'beats' then
    update public.beat_license_assignments assignments
    set is_enabled = false
    from public.beat_licenses licenses
    where assignments.beat_id = new.id
      and assignments.license_id = licenses.id
      and assignments.is_enabled = true
      and (
        (lower(btrim(coalesce(licenses.format, ''))) like '%wav%'
          and lower(btrim(coalesce(new.beat_original_path, ''))) not like '%.wav')
        or (lower(btrim(coalesce(licenses.format, ''))) like '%mp3%'
          and lower(btrim(coalesce(new.beat_mp3_path, ''))) not like '%.mp3')
        or (lower(btrim(coalesce(licenses.format, ''))) like '%stem%'
          and lower(btrim(coalesce(new.beat_stems_path, ''))) not like '%.zip')
      );
  end if;
  return new;
end;
$$;

drop trigger if exists reconcile_beat_license_assignments_for_delivery on public.store_products;
create trigger reconcile_beat_license_assignments_for_delivery
after update of beat_original_path, beat_mp3_path, beat_stems_path on public.store_products
for each row execute function public.reconcile_beat_license_assignments_for_delivery();

-- Public catalog reads fail closed even if an old invalid assignment remains.
drop policy if exists "beat assignments public enabled read" on public.beat_license_assignments;
create policy "beat assignments public enabled read"
on public.beat_license_assignments for select
to anon, authenticated
using (
  is_enabled = true
  and exists (
    select 1
    from public.store_products products
    join public.beat_licenses licenses on licenses.id = beat_license_assignments.license_id
    where products.id = beat_license_assignments.beat_id
      and products.category = 'beats'
      and products.is_active = true
      and licenses.is_active = true
      and (
        (lower(btrim(coalesce(licenses.format, ''))) not like '%wav%'
          or lower(btrim(coalesce(products.beat_original_path, ''))) like '%.wav')
        and (lower(btrim(coalesce(licenses.format, ''))) not like '%mp3%'
          or lower(btrim(coalesce(products.beat_mp3_path, ''))) like '%.mp3')
        and (lower(btrim(coalesce(licenses.format, ''))) not like '%stem%'
          or lower(btrim(coalesce(products.beat_stems_path, ''))) like '%.zip')
      )
  )
);

comment on function public.validate_beat_license_assignment() is
  'Prevents enabling a beat license when its protected delivery asset is missing.';
