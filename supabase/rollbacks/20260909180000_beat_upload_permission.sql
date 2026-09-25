-- Rollback authorization for 20260909180000_beat_upload_permission.sql.
-- Keep the additive columns to avoid deleting beat metadata or protected paths.
drop policy if exists "store products producer insert draft" on public.store_products;
drop policy if exists "store products producer update draft" on public.store_products;
drop policy if exists "store products producer read own" on public.store_products;

drop function if exists public.submit_beat_for_review(uuid);
drop function if exists public.has_beats_upload_permission();

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
      and public.is_admin()
  );
$$;
