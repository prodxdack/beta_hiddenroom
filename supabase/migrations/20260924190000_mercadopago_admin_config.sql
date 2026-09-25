set lock_timeout = '5s';
set statement_timeout = '60s';

-- Mercado Pago keys are stored in Supabase Vault, never in public tables or frontend code.
create extension if not exists supabase_vault with schema vault;

create or replace function public.mp_config_status()
returns jsonb
language sql
stable
security definer
set search_path = public, vault
as $$
  select jsonb_build_object(
    'public_key_configured', exists (select 1 from vault.secrets where name = 'mercadopago.public_key'),
    'access_token_configured', exists (select 1 from vault.secrets where name = 'mercadopago.access_token'),
    'webhook_secret_configured', exists (select 1 from vault.secrets where name = 'mercadopago.webhook_secret')
  )
  where public.is_admin();
$$;

create or replace function public.mp_public_key()
returns text
language sql
stable
security definer
set search_path = public, vault
as $$
  select decrypted_secret
  from vault.decrypted_secrets
  where name = 'mercadopago.public_key'
  limit 1;
$$;

create or replace function public.mp_runtime_config()
returns jsonb
language sql
stable
security definer
set search_path = public, vault
as $$
  select jsonb_build_object(
    'public_key', max(decrypted_secret) filter (where name = 'mercadopago.public_key'),
    'access_token', max(decrypted_secret) filter (where name = 'mercadopago.access_token'),
    'webhook_secret', max(decrypted_secret) filter (where name = 'mercadopago.webhook_secret')
  )
  from vault.decrypted_secrets
  where name in ('mercadopago.public_key', 'mercadopago.access_token', 'mercadopago.webhook_secret');
$$;

create or replace function public.set_mp_config(
  p_public_key text default null,
  p_access_token text default null,
  p_webhook_secret text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  secret_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Not authorized';
  end if;

  if nullif(btrim(coalesce(p_public_key, '')), '') is not null then
    select id into secret_id from vault.secrets where name = 'mercadopago.public_key' limit 1;
    if secret_id is null then
      perform vault.create_secret(btrim(p_public_key), 'mercadopago.public_key', 'Mercado Pago public key');
    else
      perform vault.update_secret(secret_id, btrim(p_public_key), 'mercadopago.public_key', 'Mercado Pago public key');
    end if;
  end if;

  if nullif(btrim(coalesce(p_access_token, '')), '') is not null then
    select id into secret_id from vault.secrets where name = 'mercadopago.access_token' limit 1;
    if secret_id is null then
      perform vault.create_secret(btrim(p_access_token), 'mercadopago.access_token', 'Mercado Pago access token');
    else
      perform vault.update_secret(secret_id, btrim(p_access_token), 'mercadopago.access_token', 'Mercado Pago access token');
    end if;
  end if;

  if nullif(btrim(coalesce(p_webhook_secret, '')), '') is not null then
    select id into secret_id from vault.secrets where name = 'mercadopago.webhook_secret' limit 1;
    if secret_id is null then
      perform vault.create_secret(btrim(p_webhook_secret), 'mercadopago.webhook_secret', 'Mercado Pago webhook secret');
    else
      perform vault.update_secret(secret_id, btrim(p_webhook_secret), 'mercadopago.webhook_secret', 'Mercado Pago webhook secret');
    end if;
  end if;

  return public.mp_config_status();
end;
$$;

revoke all on function public.mp_config_status() from public, anon, authenticated, service_role;
grant execute on function public.mp_config_status() to authenticated;
revoke all on function public.mp_public_key() from public, anon, authenticated, service_role;
grant execute on function public.mp_public_key() to anon, authenticated;
revoke all on function public.mp_runtime_config() from public, anon, authenticated, service_role;
grant execute on function public.mp_runtime_config() to service_role;
revoke all on function public.set_mp_config(text, text, text) from public, anon, authenticated, service_role;
grant execute on function public.set_mp_config(text, text, text) to authenticated;

revoke all on table vault.secrets from public, anon, authenticated;
revoke all on table vault.decrypted_secrets from public, anon, authenticated;
