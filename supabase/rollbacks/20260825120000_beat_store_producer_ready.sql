-- Exact local rollback for Producer Ready validation.
-- This restores the pre-20260825120000 schema/policy/function shape.
-- It does not restore any future business data written after the migration.

set lock_timeout = '5s';
set statement_timeout = '60s';

drop trigger if exists set_beat_download_delivery_path on public.store_downloads;
drop function if exists public.set_beat_download_delivery_path();

drop policy if exists "store products producer insert draft" on public.store_products;
drop policy if exists "store products producer update draft" on public.store_products;
drop policy if exists "store products public read published" on public.store_products;
create policy "store products public read active"
on public.store_products for select
to anon, authenticated
using (is_active = true or public.is_admin());

drop policy if exists "Public can read approved producer profiles" on public.producer_profiles;
drop policy if exists "Producer can read own profile" on public.producer_profiles;
create policy "Public can read active producer profiles"
on public.producer_profiles for select
to anon, authenticated
using (is_active = true or public.is_admin());

drop function if exists public.submit_beat_for_review(uuid);
drop function if exists public.review_beat_product(uuid, text, text);

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
      and (public.is_admin() or products.producer_user_id = auth.uid())
  );
$$;

revoke all on function public.can_manage_beat_product(uuid) from public, service_role;
grant execute on function public.can_manage_beat_product(uuid) to anon, authenticated;

drop function if exists public.is_approved_producer(uuid);

drop index if exists public.producer_profiles_approval_idx;
drop index if exists public.store_products_publication_idx;
drop index if exists public.store_products_review_idx;

alter table public.producer_profiles
  drop column if exists approval_status,
  drop column if exists approval_note,
  drop column if exists approved_at,
  drop column if exists approved_by;

alter table public.store_products
  drop column if exists publication_status,
  drop column if exists review_comment,
  drop column if exists submitted_at,
  drop column if exists reviewed_at,
  drop column if exists reviewed_by,
  drop column if exists beat_stems_path;
