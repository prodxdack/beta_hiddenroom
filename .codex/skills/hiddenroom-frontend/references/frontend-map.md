# Frontend Map

## Static Runtime

Hidden Room is a static site served from the repo root. Pages load global CSS from `styles.css` and use vanilla JavaScript. There is no bundler, package script, or framework runtime. Supabase browser clients import from `https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm`.

## Shared Chrome

`site.js` owns:

- `SITE_STATUS`, `SITE_VERSION`, Google Analytics bootstrap.
- Index URL cleanup and canonical OG URL hydration.
- `ECOSYSTEM_LINKS`.
- Global nav, drawer, module subnav, session UI, portal dashboard nav affordances.
- Session-aware header behavior using Supabase auth where pages include the shared chrome.

Use `data-hr-context` values already present in pages: `home`, `media`, `store`, `kairen`, `tickets`, `portal`, or `games`.

## Module Patterns

- Store uses `body.dataset.page` to choose catalog, product, cart, checkout, success, or admin flows.
- Media admin checks roles and `user_permissions.permission_key === "media.posts"`.
- Tickets admin checks `users.roles` for `admin`; generation and validation operate on `event_tickets`.
- Portal dashboard is a lightweight SPA over one static shell.
- Minigames keep local game loops and assets under `assets/sprites` and `assets/sounds`.

## Verification

Run syntax checks on changed browser JS:

```powershell
node --check site.js
node --check portal/dashboard.js
node --check media/admin.js
node --check store/store.js
node --check tickets/tickets.js
```

Serve locally:

```powershell
python -m http.server 4175 --bind 127.0.0.1
```

Inspect at `/`, `/media/`, `/media/admin.html`, `/store/`, `/tickets/`, `/portal/`, and `/portal/dashboard.html` as relevant.

## Progressive SPA shell

site.js keeps the global chrome and Beat Player outside #hr-spa-content. spa.js progressively intercepts only /, /store/, /store/beat_store/, /media/, and /academia/; it fetches and parses compatible HTML, mounts module scripts with lifecycle cleanup, updates history/meta/body state, and falls back to a full navigation on failure. It keeps a short-lived in-memory HTML view cache keyed by origin, normalized path, query, and hash; hover/focus prefetch is opt-in by route compatibility and disabled for data-saving or slow connections. Portal, Tickets, Kairen, Minijuegos, admin routes, downloads, and external/auth-sensitive routes remain traditional until explicitly migrated.
