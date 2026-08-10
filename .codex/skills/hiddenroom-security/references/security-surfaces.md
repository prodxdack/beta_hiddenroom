# Security Surfaces

## Browser

- Published Supabase anon key is allowed; service role is not.
- Escape generated markup with module helpers.
- Use local allow-lists for return URLs.
- Do not trust hidden admin links or disabled buttons as authorization.

## Edge Functions

- Handle CORS preflight.
- Reject unsupported methods.
- Parse JSON in try/catch.
- Authenticate bearer tokens when endpoint mutates or reads private data.
- Use service role only after caller authentication and authorization from a client-immutable source.
- Re-check ownership or privilege inside the function; a valid JWT or browser role gate alone is insufficient.
- Return controlled error messages.

## Payments

- Beat Store uses Mercado Pago; validate its webhook signature and provider-specific identifiers before fulfillment.
- Other products may use Stripe. Stripe checkout must re-read authoritative product data and Stripe webhooks must verify their signature before fulfillment.
- Never mix provider secrets, webhook assumptions, or fulfillment identifiers between product flows.

## Cloud

- Edge Functions enqueue only.
- Agent validates root containment with `path.resolve` and `path.relative`.
- Child names cannot include slashes, `..`, empty strings, or control characters.
- Staging storage paths cannot be absolute or contain `.` / `..` segments.
- On the live Debian host, File Browser is a local fallback bound to `127.0.0.1:8081`; keep it hidden from the public Cloudflare Tunnel unless the user explicitly approves exposing it.
- The active public route is Cloudflare Tunnel `cloud.hiddenroom.mx` to the MysAuth Cloud app on `localhost:8080`.
- Netdata must stay private on Tailscale/localhost (`100.106.132.42:19999`, `127.0.0.1:19999`, `[::1]:19999`), not `0.0.0.0`.
- Tailscale recovery automation may restart `tailscaled`, but must not store auth keys or run `tailscale up` automatically.
- When changing production cloud routing or services, use `hiddenroom-debian-server` and keep service-role secrets out of browser code and command output.

## Database

- `public.users.roles`, `get_my_role()`, and `is_admin()` are legacy compatibility inputs, not a trustworthy boundary while clients can update sensitive columns.
- Keep existing UI and business flows compatible until an approved migration introduces a protected authorization source.
- Audit table grants, column-level `UPDATE` privileges, RLS policies, and cross-user access together.
- Exposed views use `security_invoker`; privileged RPCs revoke `EXECUTE` from `PUBLIC` and grant only intended roles.
- `SECURITY DEFINER` requires internal authorization, a fixed safe `search_path`, qualified objects, and least privilege.
- Client records usually map `auth.uid()` to public `users.user_id`.
- Event finance permissions are scoped by `event_user_permissions`.
