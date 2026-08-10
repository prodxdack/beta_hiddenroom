---
name: hiddenroom-memberships
description: Hidden Room membership domain skill for changing, auditing, or explaining membership dashboards, weekly balances, Monday-Sunday week generation, public.memberships compatibility, legacy session fallback, material delivery cycles, delivery delays, membership-linked downloads, ERP Operaciones memberships, ERP BB.DD Membresia, Cliente Membresias, and Supabase RLS/migrations for memberships.
---

# Hidden Room Memberships

## Overview

Use this skill for any change involving membership contracts, membership dashboard rows, material delivery dates, membership-linked downloads, or membership admin/client parity.

This skill complements `hiddenroom-dashboard`, `hiddenroom-erp`, `hiddenroom-supabase`, `hiddenroom-security`, and `hiddenroom-testing`; use those too when the task touches UI routing, ERP forms/tables, schema/RLS, permissions, or validation.

## Workflow

1. Read the relevant membership functions in `portal/dashboard.js` before editing:
   - `renderClientMembership`
   - `renderMembershipDashboardTable`
   - `buildMembershipRows`
   - `generateMembershipWeeks`
   - `membershipMaterialDeliveries`
   - `handleMembershipDelivery`
   - download membership handlers near `handleDownloadMembershipFields`
2. Preserve admin/client dashboard parity: ERP > BB.DD. > Membresia should reflect the same membership dashboard that Cliente > Membresias sees, except admin-only search and editable delivery controls.
3. Keep `public.memberships` as the primary source of membership weeks. Use sessions only as usage evidence and legacy fallback.
4. Keep historical compatibility for old sessions, old transactions, and rows with `membership_id = null`.
5. For schema or RLS changes, add Supabase migrations and verify client/admin access paths.
6. Rehearse security changes in Supabase Local with synthetic users; test `anon`, two distinct clients, collaborator, and admin.
7. Validate with `node --check portal/dashboard.js`; run SQL/type validation when migrations change.

## Core Rules

Load [references/membership-rules.md](references/membership-rules.md) when changing calculations, delivery behavior, downloads release behavior, or explaining operational policy.

Essential invariants:

- Canonical membership value is `MEMBRESÍA`; normalize accent/no-accent variants.
- Default weekly price is `500`.
- Weeks are calendar weeks from Monday to Sunday.
- A membership creates weekly obligations even when no session exists.
- `public.memberships` is the contract source; `public.sessions` is evidence of use.
- `public.transactions` with membership service/payment records pay down weekly obligations.
- `PENDIENTE` is current-week pending payment, not overdue debt.
- `ATRASADO` plus paid date means paid late and delays material delivery.
- `saldo_tipo = 'adeudo'` is vencido; `saldo_tipo = 'pendiente'` is current pending.
- Do not show cumulative historical credit on every row; show only relevant row/current credit values.

## Files And Tables

Main frontend file:

- `portal/dashboard.js`
- `portal/dashboard.css` only for presentation changes.

Important tables:

- `public.memberships`
- `public.sessions`
- `public.transactions`
- `public.membership_material_deliveries`
- `public.downloads`

Important migrations:

- `supabase/migrations/20260612193000_membership_links.sql`
- `supabase/migrations/20260615120000_memberships_rls_policies.sql`
- `supabase/migrations/20260615123000_membership_material_deliveries.sql`
- `supabase/migrations/20260618110000_downloads_membership_deliveries.sql`

## Guardrails

- Do not rebuild the membership system from scratch; adjust the existing implementation.
- Do not make sessions the primary week generator again.
- Do not let pending current-week balances block delivery as overdue debt.
- Do not expose another user's membership data in Cliente > Membresias.
- Never grant `anon` access to `membership_dashboard`.
- A client may read only their own membership dashboard; administrators retain global access.
- Security fixes must not modify weeks, balances, deliveries, payments, notes, or historical data.
- Require parity tests between Cliente > Membresías and ERP > BB.DD. > Membresía for the same membership, allowing only documented admin controls to differ.
- Do not add admin edit controls to the client dashboard.
- Do not change canonical strings or release modes without migration and compatibility checks.
