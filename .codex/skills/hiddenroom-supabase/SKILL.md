---
name: hiddenroom-supabase
description: Hidden Room Supabase backend skill for local-first migrations, generated database types, Edge Functions, RLS policies, auth/profile sync, storage, payments, cloud_jobs, and safe read-only production diagnostics. Use when editing supabase/migrations, supabase/functions, database.types.ts, or Supabase-backed frontend queries.
---

# Hidden Room Supabase

## Workflow

1. Identify the environment before any command: local, staging, or production.
2. Inspect existing migrations, then implement a versioned forward migration plus a reviewed rollback procedure.
3. Start Supabase Local and test the migration, rollback, RLS, grants, views, RPCs, and affected Edge Functions with synthetic data.
4. Keep browser code using anon/publishable keys only; use service role only in trusted server code after internal authorization.
5. Keep RLS and database privileges as the enforcement boundary; UI role gates are presentation only.
6. Update or regenerate `supabase/database.types.ts` and root `database.types.ts` after local schema changes when possible.
7. Document required secret names, never values.

## Environment Boundaries

- Local: the only environment for SQL iteration, destructive resets, migration rehearsal, and synthetic role tests. Use explicit `--local` flags where supported.
- Staging: must be a separate, explicitly identified non-production project. Do not assume beta is staging; beta and production currently share project `rpcunbkstadgngqrjafp`.
- Production: project `rpcunbkstadgngqrjafp`; remote access is read-only by default. Do not use it to iterate or test SQL.
- Never run remote or linked variants of `db push`, `migration up`, `functions deploy`, secret changes, write SQL, or write-capable MCP operations without explicit user approval for the exact remote action. Explicitly local variants such as `migration up --local`, `db reset --local`, and local tests remain allowed.
- If a command can use the linked project and does not clearly specify `--local`, treat it as remote and do not execute it without explicit approval.
- Before an approved production change, require a verifiable backup, tested restoration, rollback, role-based tests, and human approval.

## Database Security Rules

- Create exposed views with `security_invoker = true`; otherwise revoke client access or keep the view outside exposed schemas.
- Review table grants and column privileges separately. RLS restricts rows, not which sensitive columns a role may update.
- Revoke function `EXECUTE` from `PUBLIC`, then grant only to the intended roles.
- Prefer `SECURITY INVOKER`. Use `SECURITY DEFINER` only when necessary, with internal authorization, a fixed safe `search_path`, schema-qualified objects, minimal ownership privileges, and explicit grants.
- Treat `public.users.roles`, `get_my_role()`, and `is_admin()` as legacy compatibility helpers, not a secure boundary while clients can mutate sensitive role columns.

## Backend Layout

- Migrations: `supabase/migrations/*.sql`.
- Edge Functions: `supabase/functions/*/index.ts`.
- Config: `supabase/config.toml`.
- Schema/type snapshots: `supabase/db-*.txt`, `supabase/database.types.ts`, root `database.types.ts`.
- Operational docs: `docs/store-setup.md`, `docs/cloud-agent-installation.md`.

## Edge Function Conventions

- Use `Deno.serve`.
- Return JSON through a small `json()` helper with CORS headers.
- Handle `OPTIONS` explicitly.
- Validate method, auth token, body shape, quantities, paths, and IDs before database writes.
- Use Supabase service role only after authenticating/authorizing the caller.
- Authorize inside every privileged Edge Function; a valid JWT, hidden UI, or possession of a function URL is not sufficient. Re-check ownership or privilege from a client-immutable source before service-role reads or writes.

## References

Read `references/supabase-map.md` when changing schema, RLS, storage, or functions.
