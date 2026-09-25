set lock_timeout = '5s';
set statement_timeout = '60s';

-- Minimal standalone Beat Store extension. This migration intentionally does
-- not apply the separate Producer Ready migration.
alter table public.store_products
  add column if not exists publication_status text;

alter table public.store_products
  add column if not exists beat_stems_path text;

update public.store_products
set publication_status = case when is_active then 'published' else 'draft' end
where publication_status is null;

alter table public.store_products
  alter column publication_status set default 'published',
  alter column publication_status set not null;

alter table public.store_products
  drop constraint if exists store_products_publication_status_check;

alter table public.store_products
  add constraint store_products_publication_status_check
  check (publication_status in ('draft', 'pending_review', 'published', 'inactive')) not valid;

create or replace function public.has_beats_upload_permission()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and (
      public.is_admin()
      or exists (
        select 1
        from public.user_permissions permissions
        where permissions.user_id::text = auth.uid()::text
          and lower(btrim(permissions.permission_key)) = 'beats.upload'
      )
    );
$$;

revoke all on function public.has_beats_upload_permission() from public, anon, authenticated, service_role;
grant execute on function public.has_beats_upload_permission() to anon, authenticated;

create or replace function public.can_manage_beat_product(p_beat_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.store_products products
    where products.id = p_beat_id
      and products.category = 'beats'
      and (
        public.is_admin()
        or (
          products.producer_user_id = auth.uid()
          and public.has_beats_upload_permission()
        )
      )
  );
$$;

drop policy if exists "store products producer insert draft" on public.store_products;
create policy "store products producer insert draft"
on public.store_products for insert
to authenticated
with check (
  category = 'beats'
  and producer_user_id = auth.uid()
  and public.has_beats_upload_permission()
  and publication_status = 'draft'
  and is_active = false
  and (
    producer_profile_id is null
    or exists (
      select 1
      from public.producer_profiles profiles
      where profiles.id = producer_profile_id
        and profiles.user_id = auth.uid()
    )
  )
);

drop policy if exists "store products producer update draft" on public.store_products;
create policy "store products producer update draft"
on public.store_products for update
to authenticated
using (
  category = 'beats'
  and producer_user_id = auth.uid()
  and public.has_beats_upload_permission()
  and publication_status = 'draft'
)
with check (
  category = 'beats'
  and producer_user_id = auth.uid()
  and publication_status = 'draft'
  and is_active = false
  and (
    producer_profile_id is null
    or exists (
      select 1
      from public.producer_profiles profiles
      where profiles.id = producer_profile_id
        and profiles.user_id = auth.uid()
    )
  )
);

drop policy if exists "store products producer read own" on public.store_products;
create policy "store products producer read own"
on public.store_products for select
to authenticated
using (
  category = 'beats'
  and producer_user_id = auth.uid()
  and public.has_beats_upload_permission()
);

create or replace function public.submit_beat_for_review(p_beat_id uuid)
returns public.store_products
language plpgsql
security definer
set search_path = public
as $$
declare
  beat_row public.store_products;
begin
  select * into beat_row
  from public.store_products
  where id = p_beat_id and category = 'beats'
  for update;

  if not found then raise exception 'Beat not found'; end if;
  if beat_row.producer_user_id is distinct from auth.uid()
     or not public.has_beats_upload_permission() then
    raise exception 'Producer is not authorized for this beat';
  end if;
  if beat_row.publication_status <> 'draft' then
    raise exception 'Only drafts can be submitted';
  end if;
  if nullif(btrim(beat_row.name), '') is null
     or nullif(btrim(beat_row.slug), '') is null
     or beat_row.beat_preview_status <> 'ready'
     or beat_row.beat_original_path is null
     or beat_row.beat_cover_path is null
     or not exists (
       select 1
       from public.beat_license_assignments assignments
       join public.beat_licenses licenses on licenses.id = assignments.license_id
       where assignments.beat_id = beat_row.id
         and assignments.is_enabled = true
         and licenses.is_active = true
     ) then
    raise exception 'Beat is missing required review data';
  end if;

  update public.store_products
  set publication_status = 'pending_review', is_active = false
  where id = beat_row.id
  returning * into beat_row;
  return beat_row;
end;
$$;

revoke all on function public.submit_beat_for_review(uuid) from public, anon, service_role;
grant execute on function public.submit_beat_for_review(uuid) to authenticated;

comment on column public.store_products.publication_status is
  'Beat Store lifecycle for upload permission: draft, pending_review, published, inactive.';
comment on column public.store_products.beat_stems_path is
  'Protected stems path; never a public preview URL.';
