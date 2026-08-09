# Hidden Room

Hidden Room is a Mexico City music, events, studio, media, and community platform. This repository is the product behind [hiddenroom.mx](https://hiddenroom.mx) and its authenticated operational tools: a single product that connects the audience experience with the workflows required to run the business.

## Builder profile

**Oswaldo — end-to-end builder.** I take product work from domain modeling and database policies through browser interfaces, server-side functions, integrations, deployment, and operational iteration. Hidden Room is a practical example of building a real product around an evolving business: the public website, authenticated portals, internal dashboards, commerce, content, file management, and event operations share one backend and permission model.

## What is in the repository

- **Public experience:** the main Hidden Room site, event listings, studio-session booking information, membership entry points, media, and store surfaces.
- **Authentication and portal:** Supabase Auth-backed sign-in, user profiles, role-aware navigation, dashboards, notifications, and administrative workflows.
- **Roles and authorization:** role and permission checks in the client and server layers, backed by Postgres Row Level Security (RLS), database policies, permission functions, and protected server operations.
- **ERP and event operations:** event records, participants, event finance, financial entities, permissions, and operational dashboards for running events.
- **Memberships and studio sessions:** membership cycles, deliveries/materials, access rules, and the studio-facing customer flow.
- **Tickets:** event ticketing, customer fields, batch operations, ticket permissions, and generated/downloadable ticket assets.
- **Media CMS:** posts, categories, media listings, downloads, and Instagram-related ingestion/analysis functions.
- **Store and ecommerce:** catalog and product data in Postgres, beat-store audio/cover handling, order creation, Stripe Checkout, Stripe webhooks, and Mercado Pago webhook support where configured.
- **Cloud/file management:** authenticated folders, uploads, downloads, storage access, cloud jobs, and permission-aware file operations.
- **Kairen / AI:** an AI module and the `kairen-gemini` Edge Function, with explicit database permissions and an audio-analysis function for supported workflows.

## Architecture

```text
Browser (HTML, CSS, JavaScript)
        |
        | Supabase client / authenticated API calls
        v
Supabase Auth + Postgres + RLS + Storage
        |
        +--> Edge Functions (Deno/TypeScript)
        |       payments, webhooks, cloud, media, AI, admin operations
        |
        +--> Cloud service (Node.js)
                protected file and beat-store operations
```

The frontend is deliberately built with browser-native HTML, CSS, and JavaScript modules rather than React or Next.js. The data model is shared across public, member, and administrative surfaces. Supabase provides authentication, Postgres, Row Level Security, Storage, and Edge Functions. The repository also contains a small Node.js cloud service for protected file and beat-store operations.

## Stack and delivery

- **Frontend:** JavaScript, HTML, CSS, browser modules, and WaveSurfer.js for audio UI where used.
- **Backend:** Supabase Auth, PostgreSQL, Storage, SQL migrations, RLS policies, RPC/database functions, and Supabase Edge Functions written in TypeScript/Deno.
- **Server runtime:** Node.js for the cloud service and selected API operations.
- **Payments:** Stripe Checkout and webhooks through server-side functions; Mercado Pago webhook support is also present for configured flows.
- **Delivery:** static-site delivery with a custom-domain `CNAME`, plus Cloudflare-backed cloud/edge delivery where configured. The project is designed for a GitHub Pages-style static frontend; dynamic and privileged work remains behind Supabase Functions or the Node.js cloud service.
- **Repository tooling:** Supabase CLI, npm, and a lightweight local static server.

## Product and security approach

Hidden Room is organized around real user journeys instead of isolated demos: discover an event, access a member area, manage an event, publish media, deliver files, or purchase a product. Each workflow is modeled as data and permissions first, then exposed through the smallest interface needed by its audience.

Security is treated as an architectural boundary:

- the browser uses public/publishable Supabase credentials only;
- privileged keys and payment secrets stay in server-side environment variables and Edge Functions;
- RLS and database policies enforce access at the data layer, not only through hidden UI controls;
- roles, permissions, and admin capabilities are checked before protected operations;
- checkout functions re-read catalog data server-side and validate products, quantities, and prices before creating payment sessions;
- storage paths and cloud operations are scoped to the authenticated user and their permissions;
- migrations and security-focused fixes are kept in the repository so changes can be reviewed and reproduced.

## Why this is a useful portfolio project

Hidden Room shows the complete product loop: shaping an ambiguous business into a working domain model, shipping customer-facing interfaces, building internal tools, integrating payments and media workflows, and tightening authorization as the product grows. It is intentionally not presented as a framework showcase; it is a record of pragmatic end-to-end engineering with a real operating context.

## Local development

```bash
npm install
npm run dev
```

The local server serves the static application. Supabase migrations, function configuration, and store setup documentation live under [`supabase/`](supabase/) and [`docs/`](docs/).
