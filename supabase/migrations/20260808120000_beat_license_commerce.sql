set lock_timeout = '5s';
set statement_timeout = '60s';

alter table public.store_order_items
  add column if not exists beat_id uuid references public.store_products(id) on delete set null,
  add column if not exists license_id uuid references public.beat_licenses(id) on delete set null,
  add column if not exists producer_name text,
  add column if not exists license_name text,
  add column if not exists license_snapshot jsonb not null default '{}'::jsonb;

alter table public.store_order_items
  drop constraint if exists store_order_items_license_quantity_check,
  drop constraint if exists store_order_items_license_beat_check;

alter table public.store_order_items
  add constraint store_order_items_license_quantity_check
    check (license_id is null or quantity = 1),
  add constraint store_order_items_license_beat_check
    check (license_id is null or beat_id is not null);

create index if not exists store_order_items_beat_license_idx
  on public.store_order_items (beat_id, license_id);

alter table public.store_downloads
  add column if not exists beat_id uuid references public.store_products(id) on delete set null,
  add column if not exists license_id uuid references public.beat_licenses(id) on delete set null,
  add column if not exists license_name text,
  add column if not exists license_snapshot jsonb not null default '{}'::jsonb;

do $$
declare
  download_table oid := 'public.store_downloads'::regclass;
  order_column smallint;
  product_column smallint;
  historical_constraint text;
begin
  select attnum into order_column
  from pg_attribute
  where attrelid = download_table and attname = 'order_id' and not attisdropped;

  select attnum into product_column
  from pg_attribute
  where attrelid = download_table and attname = 'product_id' and not attisdropped;

  select conname into historical_constraint
  from pg_constraint
  where conrelid = download_table
    and contype = 'u'
    and cardinality(conkey) = 2
    and conkey @> array[order_column, product_column]::smallint[]
  limit 1;

  if historical_constraint is not null then
    execute format('alter table public.store_downloads drop constraint %I', historical_constraint);
  end if;
end;
$$;

create unique index if not exists store_downloads_order_product_license_uidx
  on public.store_downloads (order_id, product_id, coalesce(license_id, '00000000-0000-0000-0000-000000000000'::uuid));

create index if not exists store_downloads_beat_license_idx
  on public.store_downloads (user_id, beat_id, license_id);

create or replace function public.fulfill_store_order(
  p_order_id uuid,
  p_stripe_session_id text,
  p_stripe_payment_intent text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  target_order public.store_orders%rowtype;
begin
  select * into target_order
  from public.store_orders
  where id = p_order_id
  for update;

  if not found then raise exception 'Store order not found'; end if;
  if target_order.status = 'paid' then return false; end if;

  update public.store_orders
  set status = 'paid', stripe_session_id = p_stripe_session_id,
    stripe_payment_intent = p_stripe_payment_intent, paid_at = now()
  where id = p_order_id;

  if target_order.user_id is not null then
    insert into public.store_downloads (
      user_id, order_id, product_id, beat_id, license_id, license_name,
      license_snapshot, file_url
    )
    select target_order.user_id, target_order.id, products.id, items.beat_id,
      items.license_id, items.license_name, items.license_snapshot, products.file_url
    from public.store_order_items items
    join public.store_products products on products.id = items.product_id
    where items.order_id = target_order.id
      and products.is_digital = true
      and products.file_url is not null
    on conflict (order_id, product_id, (coalesce(license_id, '00000000-0000-0000-0000-000000000000'::uuid))) do nothing;
  end if;

  update public.store_products products
  set stock = greatest(0, products.stock - purchased.quantity)
  from (
    select product_id, sum(quantity)::integer as quantity
    from public.store_order_items
    where order_id = target_order.id
    group by product_id
  ) purchased
  where products.id = purchased.product_id
    and products.is_digital = false
    and products.stock is not null;

  return true;
end;
$$;

revoke all on function public.fulfill_store_order(uuid, text, text) from public;
revoke all on function public.fulfill_store_order(uuid, text, text) from anon;
revoke all on function public.fulfill_store_order(uuid, text, text) from authenticated;
grant execute on function public.fulfill_store_order(uuid, text, text) to service_role;

create or replace function public.fulfill_store_order_provider(
  p_order_id uuid,
  p_provider text,
  p_provider_order_id text,
  p_provider_payment_id text,
  p_status text,
  p_raw_response jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  target_order public.store_orders%rowtype;
  generic_order_id uuid;
  normalized_status text := lower(coalesce(p_status, 'pending'));
  paid_status boolean := normalized_status in ('approved', 'paid', 'authorized');
begin
  select * into target_order
  from public.store_orders
  where id = p_order_id
  for update;

  if not found then raise exception 'Store order not found'; end if;

  select id into generic_order_id
  from public.orders
  where store_order_id = target_order.id;

  update public.store_orders
  set status = case
      when paid_status then 'paid'
      when normalized_status in ('cancelled', 'rejected', 'refunded') then normalized_status
      else status
    end,
    provider = p_provider,
    provider_order_id = coalesce(p_provider_order_id, provider_order_id),
    provider_payment_id = coalesce(p_provider_payment_id, provider_payment_id),
    paid_at = case when paid_status then coalesce(paid_at, now()) else paid_at end
  where id = target_order.id;

  if generic_order_id is not null then
    update public.orders
    set status = case
        when paid_status then 'paid'
        when normalized_status in ('cancelled', 'rejected', 'refunded') then normalized_status
        else status
      end,
      provider = p_provider,
      paid_at = case when paid_status then coalesce(paid_at, now()) else paid_at end
    where id = generic_order_id;

    insert into public.payments (
      order_id, store_order_id, user_id, provider, status, reference,
      payment_id, provider_order_id, amount, currency, raw_response, approved_at
    )
    values (
      generic_order_id, target_order.id, target_order.user_id, p_provider,
      normalized_status, target_order.external_reference, p_provider_payment_id,
      p_provider_order_id, target_order.total, target_order.currency,
      coalesce(p_raw_response, '{}'::jsonb), case when paid_status then now() else null end
    )
    on conflict (provider, payment_id) do update set
      status = excluded.status,
      provider_order_id = coalesce(excluded.provider_order_id, public.payments.provider_order_id),
      raw_response = excluded.raw_response,
      approved_at = coalesce(public.payments.approved_at, excluded.approved_at);
  end if;

  if paid_status and target_order.status <> 'paid' then
    if target_order.user_id is not null then
      insert into public.store_downloads (
        user_id, order_id, product_id, beat_id, license_id, license_name,
        license_snapshot, file_url
      )
      select target_order.user_id, target_order.id, products.id, items.beat_id,
        items.license_id, items.license_name, items.license_snapshot, products.file_url
      from public.store_order_items items
      join public.store_products products on products.id = items.product_id
      where items.order_id = target_order.id
        and products.is_digital = true
        and products.file_url is not null
      on conflict (order_id, product_id, (coalesce(license_id, '00000000-0000-0000-0000-000000000000'::uuid))) do nothing;
    end if;

    update public.store_products products
    set stock = greatest(0, products.stock - purchased.quantity)
    from (
      select product_id, sum(quantity)::integer as quantity
      from public.store_order_items
      where order_id = target_order.id
      group by product_id
    ) purchased
    where products.id = purchased.product_id
      and products.is_digital = false
      and products.stock is not null;
  end if;

  return paid_status;
end;
$$;

revoke all on function public.fulfill_store_order_provider(uuid, text, text, text, text, jsonb) from public;
revoke all on function public.fulfill_store_order_provider(uuid, text, text, text, text, jsonb) from anon;
revoke all on function public.fulfill_store_order_provider(uuid, text, text, text, text, jsonb) from authenticated;
grant execute on function public.fulfill_store_order_provider(uuid, text, text, text, text, jsonb) to service_role;
