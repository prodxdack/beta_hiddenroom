create or replace function public.get_view_as_store_orders(
  p_target_user_id uuid,
  p_beats_only boolean default false
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'admin authorization required' using errcode = '42501';
  end if;
  if p_target_user_id is null then
    raise exception 'target user is required' using errcode = '22023';
  end if;
  select jsonb_build_object(
    'orders', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', orders.id,
          'status', orders.status,
          'subtotal', orders.subtotal,
          'total', orders.total,
          'currency', orders.currency,
          'created_at', orders.created_at,
          'paid_at', orders.paid_at,
          'store_order_items', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'id', items.id,
                'product_id', items.product_id,
                'product_name', items.product_name,
                'quantity', items.quantity,
                'unit_price', items.unit_price,
                'total', items.total,
                'beat_id', items.beat_id,
                'license_id', items.license_id,
                'producer_name', items.producer_name,
                'license_name', items.license_name,
                'license_snapshot', items.license_snapshot
              ) order by items.created_at, items.id
            )
            from public.store_order_items items
            where items.order_id = orders.id
          ), '[]'::jsonb)
        ) order by orders.created_at desc, orders.id
      )
      from public.store_orders orders
      where orders.user_id = p_target_user_id
        and (
          not p_beats_only
          or exists (
            select 1 from public.store_order_items beat_items
            where beat_items.order_id = orders.id
              and beat_items.beat_id is not null
          )
        )
    ), '[]'::jsonb),
    'downloads', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', downloads.id,
          'order_id', downloads.order_id,
          'product_id', downloads.product_id,
          'beat_id', downloads.beat_id,
          'license_id', downloads.license_id,
          'license_name', downloads.license_name,
          'file_url', downloads.file_url,
          'available', downloads.available,
          'download_count', downloads.download_count,
          'created_at', downloads.created_at
        ) order by downloads.created_at desc, downloads.id
      )
      from public.store_downloads downloads
      where downloads.user_id = p_target_user_id
        and exists (
          select 1 from public.store_orders download_orders
          where download_orders.id = downloads.order_id
            and download_orders.user_id = p_target_user_id
        )
        and (not p_beats_only or downloads.beat_id is not null)
    ), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;

revoke all on function public.get_view_as_store_orders(uuid, boolean)
  from public, anon, authenticated, service_role;
grant execute on function public.get_view_as_store_orders(uuid, boolean)
  to authenticated;
comment on function public.get_view_as_store_orders(uuid, boolean)
  is 'Admin-only read path for the read-only View As Store orders screen; never mutates commerce data.';