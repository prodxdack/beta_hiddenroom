# Documentation Index

## Module Docs to Maintain

- Store: migration, secrets, checkout, webhook, products, admin panel, and the correct provider per product. Beat Store uses Mercado Pago; other products may use Stripe.
- Cloud agent: Debian service, env vars, queue behavior, staging bucket, operational logs.
- Debian server/cloud routing: Tailscale SSH, cloudflared tunnel, Docker File Browser fallback, service units, ports, and safe diagnostics.
- MysAuth Cloud app: custom Node UI/API, auth boundary, fallback File Browser, and production validation.
- Design system: migrated modules, pending work, known risks, visual QA routes.
- Supabase: migrations, RLS, generated types, functions, deployment steps.
- Testing: syntax checks, static server routes, manual auth roles.

## Command Style

Use PowerShell-friendly examples in this repo:

```powershell
node --check portal/dashboard.js
python -m http.server 4175 --bind 127.0.0.1
npx.cmd supabase status
```

Remote Supabase examples are read-only by default. Do not document `db push`, `migration up`, function deployment, secret mutation, remote write SQL, or write-capable MCP operations as routine commands; they require the safeguards and explicit approval in `AGENTS.md`.

## Public Safety

Docs may name required secret variables but must not include real secret values. Safe examples can use placeholders such as `sk_test_xxx`, `whsec_xxx`, and `https://your-project.supabase.co`.

