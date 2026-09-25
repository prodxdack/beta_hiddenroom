# Configuracion de la tienda Hidden Room

## 1. Desarrollo local y migraciones

La migracion `20260618020000_store_commerce.sql` crea la tienda base y `20260718133000_store_payment_providers.sql` agrega la capa multiproveedor:

- `store_products`
- `store_orders`
- `store_order_items`
- `store_downloads`
- `orders`
- `payments`
- politicas RLS
- seed inicial
- las RPC transaccionales `fulfill_store_order` y `fulfill_store_order_provider`

Para probar el Store sin tocar producción:

```powershell
supabase start
supabase db reset --local
```

La migración `20260825120000_beat_store_producer_ready.sql` agrega el gate
explícito de productor aprobado y los estados `draft`, `pending_review`,
`published` e `inactive`. Un productor aprobado requiere
`producer_profiles.approval_status = 'approved'` e `is_active = true`; RLS y
las RPC son la autoridad, no la UI.

La migraciÃ³n independiente `20260909180000_beat_upload_permission.sql` agrega
sÃ³lo lo necesario para otorgar la clave exacta `beats.upload` desde
`user_permissions`. Esa cuenta puede crear, editar, subir archivos y enviar a
revisiÃ³n Ãºnicamente sus propios beats; la publicaciÃ³n sigue requiriendo admin.
La pestaÃ±a `Subir` se muestra en la subnavegaciÃ³n cuando la sesiÃ³n tiene esa
clave o rol admin. No requiere aplicar las demÃ¡s migraciones locales.

La promoción remota sólo procede después del Release Gate: backup DR
descifrable y restaurado, migraciones reconciliadas, rollback probado y
autorización humana. No uses `db push`, `--linked` ni SQL remoto como parte del
desarrollo local.

## 2. Configurar secretos

```powershell
supabase secrets set STRIPE_SECRET_KEY="sk_test_xxx"
supabase secrets set STRIPE_WEBHOOK_SECRET="whsec_xxx"
supabase secrets set MP_ACCESS_TOKEN="APP_USR_xxx"
supabase secrets set MP_WEBHOOK_SECRET="tu_clave_secreta_webhook"
supabase secrets set SITE_URL="https://hiddenroom.mx"
```

Comprueba que existan sin imprimir sus valores:

```powershell
supabase secrets list
```

`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` estan disponibles automaticamente en las Edge Functions del proyecto. Nunca copies la service role ni las claves secretas de Stripe o Mercado Pago al frontend.

El panel `Beat Store > Admin > Mercado Pago` guarda `public_key`, `access_token` y `webhook_secret` en Supabase Vault mediante las funciones `set_mp_config` y `mp_config_status`. Los Edge Functions de checkout y webhook leen el token y la firma desde `mp_runtime_config`; las variables `MP_ACCESS_TOKEN` y `MP_WEBHOOK_SECRET` quedan como fallback de compatibilidad.

La tienda espera una llave publica de Mercado Pago en `window.VITE_MP_PUBLIC_KEY` para montar Card Payment Brick. En produccion puede inyectarse como variable publica `VITE_MP_PUBLIC_KEY`; nunca uses `MP_ACCESS_TOKEN` ni `MP_WEBHOOK_SECRET` en archivos del frontend.

## 3. Desplegar funciones

```powershell
supabase functions deploy create-checkout-session
supabase functions deploy stripe-webhook
supabase functions deploy create-order
supabase functions deploy mercadopago-webhook --no-verify-jwt
```

`supabase/config.toml` tambien mantiene `verify_jwt = false` para `mercadopago-webhook`, porque Mercado Pago no envia JWT de Supabase. La funcion valida internamente `x-signature` usando `MP_WEBHOOK_SECRET` antes de consultar el pago.

## 4. Configurar webhooks

### Stripe

Crea un endpoint para:

```text
https://rpcunbkstadgngqrjafp.supabase.co/functions/v1/stripe-webhook
```

Suscribe el evento:

```text
checkout.session.completed
```

Copia el signing secret generado por Stripe a `STRIPE_WEBHOOK_SECRET`.

### Mercado Pago

Crea un endpoint para:

```text
https://rpcunbkstadgngqrjafp.supabase.co/functions/v1/mercadopago-webhook
```

Activa por lo menos las notificaciones de:

```text
Pagos
```

La funcion valida `x-signature` con el secreto del webhook, obtiene el `payment_id`/`data.id`, consulta el recurso real en Mercado Pago con `MP_ACCESS_TOKEN`, busca `external_reference`, compara monto y moneda contra `store_orders`, y actualiza `orders`, `payments` y `store_orders` mediante `fulfill_store_order_provider`.

No confies solo en el cuerpo recibido por el webhook: el cuerpo sirve para ubicar la notificacion, pero la fuente de verdad del estado es la consulta directa a Mercado Pago.

## 5. Productos digitales

`file_url` debe apuntar a un archivo protegido o a una ruta que despues pueda intercambiarse por una URL firmada. No uses archivos privados expuestos en un bucket publico. El webhook crea `store_downloads` solamente para compras ligadas a usuarios autenticados.

## 6. Paneles y Producer Ready

- Catalogo: `/store/`
- Mis compras: `/store/orders.html`
- Administracion: `/store/admin.html`
- Mis Beats: `/store/beat_store/my-beats.html`
- Nuevo Beat: `/store/beat_store/new-beat.html`
- Revisión admin: `/store/beat_store/review.html`

El panel admin se oculta para usuarios normales, pero la proteccion real esta
en RLS, `public.is_admin()`, `public.is_approved_producer()` y las RPC de
transición de estado. Los previews usan rutas públicas; masters/stems sólo
viajan por la descarga autorizada.
## 7. Autodeteccion BPM y tonalidad con Essentia

El panel de Beat Store usa `/functions/v1/analyze-beat-audio` para que admins o productores aprobados, activos y con `beats.upload` puedan autodetectar BPM y tonalidad desde el archivo seleccionado. La Edge Function valida la sesion Supabase y reenvia el audio al servicio privado de Debian; al analizar un beat ya guardado, comprueba que la ruta pertenezca al productor autenticado.

Secretos requeridos en Supabase:

```powershell
supabase secrets set BEAT_ANALYZER_URL="https://cloud.hiddenroom.mx/api/beat-store/analyze-audio"
supabase secrets set BEAT_ANALYZER_SECRET="genera_un_secreto_largo"
supabase functions deploy analyze-beat-audio
```

En Debian, instala Essentia y levanta el servicio privado del repo:

```bash
sudo apt update
sudo apt install -y python3-pip ffmpeg
python3 -m pip install --user essentia numpy
```

Ejemplo de variables para el servicio Debian, sin guardar valores reales en Git:

```bash
export BEAT_ANALYZER_HOST="127.0.0.1"
export BEAT_ANALYZER_PORT="8092"
export BEAT_ANALYZER_SECRET="el_mismo_secreto_de_supabase"
python3 tools/beat-audio-analyzer/server.py
```

En produccion corre con systemd escuchando solo en localhost. La Edge Function llama a `https://cloud.hiddenroom.mx/api/beat-store/analyze-audio`, y MysAuth Cloud reenvia internamente a `127.0.0.1:8092` usando `BEAT_ANALYZER_SECRET`. No expongas el puerto `8092` directo a internet.

## 8. Edicion controlada de beats

En las tarjetas de `/store/beat_store/` el menu de opciones solo se renderiza para:

- un administrador, sobre cualquier beat;
- el productor aprobado autenticado, solamente sobre beats cuyo `producer_user_id` coincide con su usuario.

El productor puede abrir un beat publicado para editarlo, pero al guardar vuelve a `draft` e `is_active = false`; despues debe enviarlo a revision para que un administrador lo publique de nuevo. La regla de ownership no depende del menu visual: la policy `store products producer edit published` de `supabase/migrations/20260916130000_beat_producer_card_edit.sql` mantiene el limite en Supabase.

QA local antes de release:

```powershell
node --check store/beat_store/bs.js
node --check store/beat_store/new-beat.js
npx.cmd supabase test db --local
```

Rollback: retirar la migracion `20260916130000_beat_producer_card_edit.sql` solo mediante el procedimiento local/versionado del proyecto y conservar el flujo anterior de edicion de drafts. No ejecutar cambios remotos sin backup verificable, prueba de restore y aprobacion humana.
