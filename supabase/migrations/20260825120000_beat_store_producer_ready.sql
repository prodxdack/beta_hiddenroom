set lock_timeout = '5s';
set statement_timeout = '60s';

-- Producer Ready: explicit approval and publication state. Existing active
-- producer profiles were already public; preserve that public contract.
alter table public.producer_profiles
  add column if not exists approval_status text not null default 'pending',
  add column if not exists approval_note text,
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by uuid references auth.users(id) on delete set null;

alter table public.producer_profiles
  drop constraint if exists producer_profiles_approval_status_check;

alter table public.producer_profiles
  add constraint producer_profiles_approval_status_check
  check (approval_status in ('pending', 'approved', 'rejected', 'suspended')) not valid;

update public.producer_profiles
set approval_status = 'approved', approved_at = coalesce(approved_at, updated_at)
where is_active = true and approval_status = 'pending';

alter table public.store_products
  add column if not exists publication_status text not null default 'published',
  add column if not exists review_comment text,
  add column if not exists submitted_at timestamptz,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists beat_stems_path text;

alter table public.store_products
  drop constraint if exists store_products_publication_status_check;

alter table public.store_products
  add constraint store_products_publication_status_check
  check (publication_status in ('draft', 'pending_review', 'published', 'inactive')) not valid;

update public.store_products
set publication_status = case when is_active then 'published' else 'inactive' end
where category = 'beats';

create index if not exists producer_profiles_approval_idx
  on public.producer_profiles (approval_status, is_active, user_id);
create index if not exists store_products_publication_idx
  on public.store_products (category, publication_status, is_active, created_at desc);
create index if not exists store_products_review_idx
  on public.store_products (category, publication_status, submitted_at desc)
  where category = 'beats';

create or replace function public.is_approved_producer(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.producer_profiles
    where user_id = p_user_id
      and is_active = true
      and approval_status = 'approved'
  );
$$;

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
        or (products.producer_user_id = auth.uid() and public.is_approved_producer(auth.uid()))
      )
  );
$$;

drop policy if exists "Public can read active producer profiles" on public.producer_profiles;
create policy "Public can read approved producer profiles"
on public.producer_profiles for select
to anon, authenticated
using ((is_active = true and approval_status = 'approved') or public.is_admin());

drop policy if exists "Producer can read own profile" on public.producer_profiles;
create policy "Producer can read own profile"
on public.producer_profiles for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "store products public read active" on public.store_products;
create policy "store products public read published"
on public.store_products for select
to anon, authenticated
using (
  (category = 'beats' and is_active = true and publication_status = 'published')
  or (category <> 'beats' and is_active = true)
  or public.is_admin()
  or (category = 'beats' and producer_user_id = auth.uid())
);

drop policy if exists "store products producer insert draft" on public.store_products;
create policy "store products producer insert draft"
on public.store_products for insert
to authenticated
with check (
  category = 'beats'
  and producer_user_id = auth.uid()
  and public.is_approved_producer(auth.uid())
  and publication_status = 'draft'
  and is_active = false
);

drop policy if exists "store products producer update draft" on public.store_products;
create policy "store products producer update draft"
on public.store_products for update
to authenticated
using (
  category = 'beats'
  and producer_user_id = auth.uid()
  and public.is_approved_producer(auth.uid())
  and publication_status = 'draft'
)
with check (
  category = 'beats'
  and producer_user_id = auth.uid()
  and publication_status = 'draft'
  and is_active = false
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
  if beat_row.producer_user_id is distinct from auth.uid() or not public.is_approved_producer(auth.uid()) then
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
  set publication_status = 'pending_review', is_active = false,
      submitted_at = now(), review_comment = null
  where id = beat_row.id
  returning * into beat_row;
  return beat_row;
end;
$$;

create or replace function public.review_beat_product(
  p_beat_id uuid,
  p_decision text,
  p_comment text default null
)
returns public.store_products
language plpgsql
security definer
set search_path = public
as $$
declare
  beat_row public.store_products;
  decision text := lower(btrim(coalesce(p_decision, '')));
begin
  if not public.is_admin() then raise exception 'Not authorized'; end if;
  if decision not in ('approve', 'return', 'inactivate') then raise exception 'Invalid review decision'; end if;

  select * into beat_row
  from public.store_products
  where id = p_beat_id and category = 'beats'
  for update;
  if not found then raise exception 'Beat not found'; end if;

  if decision = 'approve' then
    if beat_row.beat_preview_status <> 'ready' or beat_row.beat_original_path is null then
      raise exception 'Beat audio is not ready';
    end if;
    update public.store_products
    set publication_status = 'published', is_active = true,
        reviewed_at = now(), reviewed_by = auth.uid(), review_comment = null
    where id = beat_row.id
    returning * into beat_row;
  elsif decision = 'return' then
    update public.store_products
    set publication_status = 'draft', is_active = false,
        reviewed_at = now(), reviewed_by = auth.uid(), review_comment = nullif(btrim(p_comment), '')
    where id = beat_row.id
    returning * into beat_row;
  else
    update public.store_products
    set publication_status = 'inactive', is_active = false,
        reviewed_at = now(), reviewed_by = auth.uid(), review_comment = nullif(btrim(p_comment), '')
    where id = beat_row.id
    returning * into beat_row;
  end if;
  return beat_row;
end;
$$;

revoke all on function public.is_approved_producer(uuid) from public, anon, service_role;
grant execute on function public.is_approved_producer(uuid) to authenticated;
revoke all on function public.submit_beat_for_review(uuid) from public, anon, service_role;
grant execute on function public.submit_beat_for_review(uuid) to authenticated;
revoke all on function public.review_beat_product(uuid, text, text) from public, anon, service_role;
grant execute on function public.review_beat_product(uuid, text, text) to authenticated;
revoke all on function public.can_manage_beat_product(uuid) from public, service_role;
grant execute on function public.can_manage_beat_product(uuid) to anon, authenticated;

comment on column public.producer_profiles.approval_status is 'Explicit producer gate: pending, approved, rejected, or suspended.';
comment on column public.store_products.publication_status is 'Beat Store lifecycle: draft, pending_review, published, inactive.';
comment on column public.store_products.beat_stems_path is 'Protected stems path; never a public preview URL.';

-- Preserve the existing fulfillment path while selecting the correct file for
-- licenses that explicitly include stems. The cloud download endpoint still
-- re-checks entitlement and revocation before serving this path.
create or replace function public.set_beat_download_delivery_path()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_path text;
begin
  if new.product_id is null then return new; end if;
  select case
    when products.beat_stems_path is not null
      and coalesce(items.license_snapshot->>'format', '') ilike '%stems%'
      then '/beats_store/' || products.beat_stems_path
    else coalesce(products.file_url, new.file_url)
  end
  into selected_path
  from public.store_products products
  left join public.store_order_items items
    on items.order_id = new.order_id
   and items.product_id = new.product_id
   and (items.license_id is not distinct from new.license_id)
  where products.id = new.product_id;

  if selected_path is not null then new.file_url = selected_path; end if;
  return new;
end;
$$;

drop trigger if exists set_beat_download_delivery_path on public.store_downloads;
create trigger set_beat_download_delivery_path
before insert on public.store_downloads
for each row execute function public.set_beat_download_delivery_path();

revoke all on function public.set_beat_download_delivery_path() from public;
grant execute on function public.set_beat_download_delivery_path() to service_role;
