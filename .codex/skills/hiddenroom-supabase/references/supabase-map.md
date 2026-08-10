# Supabase Map

## Current Feature Areas

- Auth/profile sync: `users`, `users_safe`, auth triggers, `email_is_registered`, admin user functions.
- Events and ERP: `events`, `hr_transactions`, `event_user_permissions`, `event_counterparties`, `event_participations`.
- Store and payments: Beat Store uses Mercado Pago. Other current or future products may use Stripe; do not assume one provider applies to every store flow. Shared data includes `store_products`, `store_orders`, `store_order_items`, `store_downloads`, and RPC `fulfill_store_order`.
- Media CMS: `media_posts`, `media-covers` storage.
- Tickets: `event_tickets`, ticket type migration, validation flows.
- Cloud: `cloud_jobs`, private `cloud-staging` bucket, cloud Edge Functions.
- Scores/memberships/downloads/contracts/sessions/tasks: dashboard operational data.

## Important Functions

- `get_my_role()`: legacy role text helper; not a secure boundary while its source columns are client-mutable.
- `is_admin()`: legacy admin helper with the same limitation.
- `my_user_id()`: maps auth user to public user id.
- `handle_new_auth_user()`: auth trigger.
- `sync_public_user_email_from_auth()`: auth email sync trigger.
- `set_updated_at()`: timestamp trigger.

## Function Secrets

- Payments: Mercado Pago secrets belong to Beat Store functions; Stripe secrets belong only to products that actually use Stripe. `SITE_URL` may be shared where required.
- Cloud/Kairen functions also depend on Supabase function env values and provider secrets as configured outside source.
- Never place `SUPABASE_SERVICE_ROLE_KEY` in browser files or GitHub Pages.

## Safe Local CLI Checks

Useful commands:

```powershell
npx.cmd supabase start
npx.cmd supabase status
npx.cmd supabase migration list --local
npx.cmd supabase db reset --local
```

Do not place linked-project mutation or deploy commands in routine checklists. Remote diagnostics are read-only by default; production mutations require the safeguards and explicit approval in the parent Skill and `AGENTS.md`.
