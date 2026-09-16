const SITE_STATUS = "BETA Sitio en construcción";
const SITE_VERSION = "V. 2.5.0";
const GA_MEASUREMENT_ID = "G-VNHC1Z3FXZ";
const HR_SUPABASE_URL = "https://rpcunbkstadgngqrjafp.supabase.co";
const HR_SUPABASE_ANON_KEY = "sb_publishable_7v_FIgTjWjJgtT1YHIAYSw_bRBmQjZO";
const HR_SUPABASE_CDN = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";
const ECOSYSTEM_LINKS = [
  ["academia", "/academia/", "Academia"],
  ["games", "/minijuegos/", "Minijuegos"],
  ["media", "/media/", "Media"],
  ["store", "/store/", "Store"],
  ["studio", "/studio/", "Studio"],
  ["beat-store", "/store/beat_store/", "Beat Store"],
  ["kairen", "/kairen/", "Kairen AI"],
  ["tickets", "/tickets/", "Tickets"],
  ["orbit", "/mysauth_orbit/", "ORBIT", true],
];

let globalSessionSnapshot = null;

function setGlobalAuthState(state) {
  document.querySelectorAll("[data-hr-session], [data-hr-drawer-session]").forEach((target) => {
    target.dataset.hrAuthState = state;
    target.setAttribute("aria-busy", state === "loading" ? "true" : "false");
  });
  document.body?.classList.toggle("hr-auth-loading", state === "loading");
}

function getHiddenRoomSupabaseClient() {
  if (window.__hiddenRoomSupabaseClient) {
    return Promise.resolve(window.__hiddenRoomSupabaseClient);
  }

  if (!window.__hiddenRoomSupabaseClientPromise) {
    window.__hiddenRoomSupabaseClientPromise = import(HR_SUPABASE_CDN).then(({ createClient }) => {
      window.__hiddenRoomSupabaseClient = window.__hiddenRoomSupabaseClient
        || createClient(HR_SUPABASE_URL, HR_SUPABASE_ANON_KEY);
      return window.__hiddenRoomSupabaseClient;
    });
  }

  return window.__hiddenRoomSupabaseClientPromise;
}

window.HiddenRoomSupabase = window.HiddenRoomSupabase || {
  url: HR_SUPABASE_URL,
  anonKey: HR_SUPABASE_ANON_KEY,
  getClient: getHiddenRoomSupabaseClient,
};

function initAnalytics() {
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag(){ window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', GA_MEASUREMENT_ID);
}

function cleanIndexURL() {
  const { pathname, search, hash } = window.location;
  if (!pathname.endsWith('/index.html')) return;

  const cleanPath = pathname.slice(0, -'index.html'.length);
  window.history.replaceState(null, '', `${cleanPath}${search}${hash}`);
}

function hydrateCanonicalMeta() {
  const cleanURL = new URL(window.location.href);
  if (cleanURL.pathname.endsWith('/index.html')) {
    cleanURL.pathname = cleanURL.pathname.slice(0, -'index.html'.length);
  }

  document.querySelectorAll('meta[property="og:url"]').forEach((meta) => {
    meta.setAttribute('content', cleanURL.href);
  });
}

cleanIndexURL();
hydrateCanonicalMeta();
initAnalytics();

function renderSubNav(module) {
  const path = window.location.pathname;
  const hash = window.location.hash.slice(1);
  const searchParams = new URLSearchParams(window.location.search);
  const page = document.body.dataset.page || "";
  const item = (href, label, active = false, attrs = "") => (
    `<a class="hr-nav__sub-link" href="${href}"${active ? ' aria-current="page"' : ""}${attrs}>${label}</a>`
  );

  if (module === "media") {
    return [
      item("/media/", "Publicaciones", !path.includes("/admin")),
      item("/media/#media-filters", "Categorías"),
      item(
        "/media/admin.html",
        "CMS",
        path.includes("/admin"),
        ` data-media-admin-link${path.includes("/admin") ? "" : " hidden"}`,
      ),
    ].join("");
  }

  if (module === "academia") {
    const view = searchParams.get("view") || hash;
    const isAdmin = view === "admin";
    return [
      item("/academia/", "Cursos", !isAdmin && view !== "my"),
      item("/academia/?view=my", "Mis cursos", view === "my"),
      item("/academia/?view=admin", "Admin", isAdmin, " data-admin-nav-link hidden"),
    ].join("");
  }

  if (module === "store") {
    const isBeatStore = path.startsWith("/store/beat_store/");
    if (isBeatStore) {
      const isBeatAdmin = searchParams.get("view") === "admin" || searchParams.get("admin") === "1";
      const isBeatUpload = path.endsWith("/new-beat.html");
      return [
        item("/store/beat_store/", "Explorar beats", !isBeatAdmin && !isBeatUpload),
        item("/store/cart.html", 'Carrito <span class="cart-count">0</span>', path.endsWith("/cart.html")),
        item(
          "/store/beat_store/new-beat.html",
          "Subir",
          isBeatUpload,
          ' data-permission-nav-link="beats.upload" hidden',
        ),
        item(
          "/store/beat_store/?view=admin",
          "Admin beats",
          isBeatAdmin,
          " data-admin-nav-link hidden data-beat-admin-entry",
        ),
      ].join("");
    }

    const isAdminStore = path.endsWith("/store/admin.html");
    return [
      item("/store/", "Tienda", (page === "catalog" || page === "product") && !isAdminStore),
      item(
        "/store/admin.html",
        "Admin Store",
        isAdminStore,
        " data-admin-nav-link hidden",
      ),
      item("/store/cart.html", 'Carrito <span class="cart-count">0</span>', page === "cart"),
      item(
        "/store/orders.html",
        "Mis compras",
        path.endsWith("/orders.html"),
        path.endsWith("/orders.html") ? "" : " data-auth-link hidden",
      ),
    ].join("");
  }
  if (module === "media" && document.body.classList.contains("media-admin")) {
    return `
      <a class="hr-nav__action" href="/media/" target="_blank" rel="noopener">Ver Media</a>
      <button class="hr-nav__action" id="logout-button" type="button">Cerrar sesión</button>
    `;
  }

  if (module === "games") {
    return [
      item("/minijuegos/", "Juegos", true),
      item("/portal/dashboard.html#client-rewards", "Ranking"),
    ].join("");
  }

  if (module === "portal") {
    return "";
  }

  if (module === "tickets") {
    return [
      item("/tickets/", "Eventos", path.endsWith("/tickets/") || path.endsWith("/tickets/index.html")),
      item("/tickets/validate.html", "Validar", path.endsWith("/validate.html")),
      item("/tickets/generate.html", "Admin", path.endsWith("/generate.html") || path.endsWith("/view.html")),
    ].join("");
  }

  return "";
}

function renderNavActions(module) {
  if (document.body.classList.contains("db-body")) {
    return `
      <button class="hr-nav__notifications" id="js-notifications-toggle" aria-label="Notificaciones"
        aria-expanded="false" aria-controls="js-notifications-panel">
        <svg class="hr-nav__notification-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M10.27 21a2 2 0 0 0 3.46 0" />
          <path d="M3.26 15.33A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.67C19.41 13.96 18 12.5 18 10a6 6 0 0 0-12 0c0 2.5-1.41 3.96-2.74 5.33Z" />
        </svg>
        <span class="hr-nav__notifications-label">Notificaciones</span>
        <span class="hr-nav__notification-count" id="js-notif-count"
          aria-label="notificaciones sin leer" hidden></span>
      </button>
      <button class="hr-nav__account hr-nav__account--button" id="js-user-menu-toggle"
        aria-haspopup="true" aria-expanded="false"
        aria-controls="js-user-menu js-sidebar" aria-label="Abrir menú">
        <span class="hr-nav__avatar" id="js-user-avatar" aria-hidden="true"></span>
        <span class="hr-nav__hello" id="js-user-display-name">-</span>
      </button>
      <nav class="db-user-menu" id="js-user-menu" aria-label="Menú de usuario" hidden>
        <ul class="db-user-menu__list" role="list">
          <li><a class="db-user-menu__item" href="/">Volver al sitio</a></li>
          <li><button class="db-user-menu__item" data-action="profile">Perfil</button></li>
          <li><button class="db-user-menu__item" data-action="settings">Ajustes</button></li>
          <li><button class="db-user-menu__item db-user-menu__item--danger" data-action="logout">Cerrar sesión</button></li>
        </ul>
      </nav>
    `;
  }

  const moduleAction = module === "store" ? `
      <a class="hr-nav__action hr-nav__action--cart" href="/store/cart.html">
        Carrito <span class="cart-count">0</span>
      </a>
    ` : "";

  return `
    ${moduleAction}
    <div class="hr-nav__session" data-hr-session>
      ${globalSessionSnapshot
        ? authenticatedHeaderMarkup(globalSessionSnapshot.profile, globalSessionSnapshot.user, globalSessionSnapshot.unread)
        : globalAuthLoadingMarkup()}
    </div>
    <span id="session-user" class="hr-nav__user" hidden></span>
  `;
}

function globalAuthLoadingMarkup(drawer = false) {
  if (drawer) {
    return '<div class="hr-global-drawer__auth-loading" aria-hidden="true"><span></span><span></span></div>';
  }
  return `
    <div class="hr-nav__auth-loading" aria-hidden="true">
      <span class="hr-nav__auth-loading-bell"></span>
      <span class="hr-nav__auth-loading-account"><i></i><b></b></span>
    </div>
  `;
}

function renderGlobalDrawer(activeModule) {
  const isPortalDashboard = document.body.classList.contains("db-body");
  const drawerSessionMarkup = isPortalDashboard
    ? `
          <div class="hr-global-drawer__guest hr-global-drawer__guest--portal">
            <button type="button" data-global-nav-action="settings">Ajustes</button>
            <button type="button" data-global-nav-action="logout">Cerrar sesión</button>
          </div>
        `
    : `
          <div class="hr-global-drawer__guest">
            <a href="/portal/">Ingresar</a>
            <a href="/portal/?mode=register">Registrarse</a>
          </div>
        `;

  return `
    <button class="hr-global-drawer__backdrop" type="button"
      data-global-drawer-close aria-label="Cerrar menú" hidden></button>
    <aside class="hr-global-drawer" id="hr-global-drawer"
      aria-label="Menú principal" aria-hidden="true" hidden>
      <header class="hr-global-drawer__header">
        <a class="hr-global-drawer__brand" href="/" aria-label="Hidden Room, inicio">
          <img src="/assets/img/white_logo.webp" alt="Hidden Room">
        </a>
        <button class="hr-global-drawer__close" type="button"
          data-global-drawer-close aria-label="Cerrar menú">x</button>
      </header>
      <p class="hr-global-drawer__label">Ecosistema</p>
      <nav class="hr-global-drawer__links" aria-label="Navegación móvil">
        ${ECOSYSTEM_LINKS.map(([key, href, label, adminOnly]) => `
          <a href="${href}"${adminOnly ? ' data-admin-nav-link hidden' : ""}${(key === activeModule && !(activeModule === "store" && window.location.pathname.startsWith("/store/beat_store/"))) || (key === "beat-store" && window.location.pathname.startsWith("/store/beat_store/")) ? ' aria-current="page"' : ""}>
            <span>${label}</span>
          </a>
        `).join("")}
      </nav>
      <div class="hr-global-drawer__footer">
        <div data-hr-drawer-session>
          ${globalSessionSnapshot
            ? authenticatedHeaderMarkup(globalSessionSnapshot.profile, globalSessionSnapshot.user, globalSessionSnapshot.unread, true)
            : globalAuthLoadingMarkup(true)}
        </div>
        <div class="hr-global-drawer__meta">
          <span class="site-status"></span>
          <a href="/changelog.html" class="site-version"></a>
        </div>
      </div>
    </aside>
  `;
}

function escapeNavText(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function firstName(value, fallback = "Usuario") {
  return String(value || fallback).trim().split(/\s+/)[0] || fallback;
}

function globalDisplayName(profile, user) {
  return firstName(
    profile?.display_name ||
      profile?.username ||
      user?.user_metadata?.display_name ||
      user?.user_metadata?.full_name ||
      user?.user_metadata?.name ||
      "Usuario",
  );
}

function globalAvatarSrc(value) {
  const fallback = "/assets/img/np-negative.webp";
  const avatar = String(value || "").trim();
  if (!/^https?:\/\//i.test(avatar)) return fallback;

  try {
    const url = new URL(avatar);
    const host = url.hostname.toLowerCase();
    const blockedHosts = ["cdninstagram.com", "fbcdn.net", "facebook.com", "fbsbx.com"];
    if (blockedHosts.some((blocked) => host === blocked || host.endsWith(`.${blocked}`))) {
      return fallback;
    }
    return url.href;
  } catch (_error) {
    return fallback;
  }
}

function cleanGlobalInstagramUsername(value) {
  return String(value ?? "")
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/^@+/, "")
    .split(/[/?#\s]/)[0]
    .replace(/[^a-zA-Z0-9._]/g, "")
    .slice(0, 30);
}

let instagramUsernamePromptOpen = false;
let instagramUsernamePromptResolved = false;

function showGlobalInstagramUsernamePrompt(profile, user, supabase) {
  if (!user?.id || profile?.ig_username || instagramUsernamePromptOpen || instagramUsernamePromptResolved) return;
  if (document.getElementById("js-onboarding-gate")) {
    window.setTimeout(() => showGlobalInstagramUsernamePrompt(profile, user, supabase), 1800);
    return;
  }

  document.getElementById("hr-instagram-username-gate")?.remove();
  instagramUsernamePromptOpen = true;

  const displayName = profile?.display_name || profile?.username || user?.email?.split("@")[0] || "Usuario";
  const overlay = document.createElement("div");
  overlay.id = "hr-instagram-username-gate";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-labelledby", "hr-instagram-username-title");
  overlay.style.cssText = [
    "position:fixed",
    "inset:0",
    "background:rgba(0,0,0,.82)",
    "z-index:var(--hr-z-overlay,10001)",
    "display:flex",
    "align-items:center",
    "justify-content:center",
    "padding:16px",
  ].join(";");

  overlay.innerHTML = `
    <div style="width:min(460px,100%);background:#101010;color:#f8f8f8;border:1px solid rgba(255,255,255,.16);border-radius:8px;box-shadow:0 24px 80px rgba(0,0,0,.45);padding:20px;">
      <h2 id="hr-instagram-username-title" style="margin:0 0 8px;font-size:1.2rem;">Instagram</h2>
      <p style="margin:0 0 16px;color:#d7d7d7;line-height:1.45;">
        <strong>${escapeNavText(displayName)}</strong> Escribe tu usuario de instagram, es importante para que no tengas problemas con tus beneficios.
      </p>
      <form data-hr-instagram-username-form>
        <label style="display:grid;gap:6px;margin-bottom:14px;">
          <span style="font-size:.86rem;color:#bdbdbd;">Usuario de Instagram</span>
          <input name="ig_username" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="tu_usuario" required
            style="width:100%;box-sizing:border-box;border:1px solid rgba(255,255,255,.18);border-radius:8px;background:#050505;color:#fff;padding:12px;font:inherit;" />
        </label>
        <button type="submit" style="width:100%;border:0;border-radius:8px;background:#fff;color:#000;padding:12px 14px;font-weight:700;cursor:pointer;">Guardar Instagram</button>
        <div data-hr-instagram-username-status hidden style="margin-top:10px;color:#fca5a5;font-size:.86rem;"></div>
      </form>
    </div>
  `;

  document.body.appendChild(overlay);
  overlay.querySelector("input[name='ig_username']")?.focus();

  overlay.querySelector("form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const submit = form.querySelector("button[type='submit']");
    const status = form.querySelector("[data-hr-instagram-username-status]");
    const igUsername = cleanGlobalInstagramUsername(new FormData(form).get("ig_username"));

    if (!igUsername || igUsername.length < 2) {
      if (status) {
        status.hidden = false;
        status.textContent = "Escribe un usuario de Instagram valido.";
      }
      return;
    }

    submit.disabled = true;
    try {
      const { error } = await supabase
        .from("users")
        .update({ ig_username: igUsername })
        .eq("id", user.id);

      if (error) throw error;

      instagramUsernamePromptResolved = true;
      instagramUsernamePromptOpen = false;
      overlay.remove();
      window.dispatchEvent(new CustomEvent("hiddenroom:ig-username-updated", { detail: { ig_username: igUsername } }));
    } catch (error) {
      console.info("[HR] No se pudo guardar Instagram:", error?.message || error);
      submit.disabled = false;
      if (status) {
        status.hidden = false;
        status.textContent = error?.message || "No se pudo guardar tu Instagram.";
      }
    }
  });
}
function authenticatedHeaderMarkup(profile, user, unread = 0, drawer = false) {
  const name = globalDisplayName(profile, user);
  const avatarSrc = globalAvatarSrc(profile?.avatar_url);
  const avatarMarkup = `<img src="${escapeNavText(avatarSrc)}" alt=""
    referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='/assets/img/np-negative.webp'">`;

  if (drawer) {
    return `
      <a class="hr-global-drawer__account" href="/portal/dashboard.html">
        <span class="hr-nav__avatar">${avatarMarkup}</span>
        <span class="hr-global-drawer__hello">Hola, <strong>${escapeNavText(name)}</strong></span>
      </a>
      <a class="hr-global-drawer__portal" href="/portal/dashboard.html">Portal</a>
    `;
  }

  return `
    <button class="hr-nav__notifications" type="button" data-hr-notifications-toggle
      aria-label="Notificaciones${unread ? `, ${unread} sin leer` : ""}"
      aria-controls="hr-global-notifications" aria-expanded="false">
      <svg class="hr-nav__notification-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M10.27 21a2 2 0 0 0 3.46 0" />
        <path d="M3.26 15.33A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.67C19.41 13.96 18 12.5 18 10a6 6 0 0 0-12 0c0 2.5-1.41 3.96-2.74 5.33Z" />
      </svg>
      <span class="hr-nav__notifications-label">Notificaciones</span>
      ${unread ? '<span class="hr-nav__notification-count" aria-hidden="true"></span>' : ""}
    </button>
    <a class="hr-nav__account" href="/portal/dashboard.html">
      <span class="hr-nav__avatar">${avatarMarkup}</span>
      <span class="hr-nav__hello">Hola, <strong>${escapeNavText(name)}</strong></span>
    </a>
  `;
}

function guestHeaderMarkup(drawer = false) {
  if (drawer) {
    return `
      <div class="hr-global-drawer__guest">
        <a href="/portal/">Ingresar</a>
        <a href="/portal/?mode=register">Registrarse</a>
      </div>
    `;
  }

  return `
    <div class="hr-nav__guest">
      <a href="/portal/">Ingresar</a>
      <span aria-hidden="true">|</span>
      <a href="/portal/?mode=register">Registrarse</a>
    </div>
  `;
}

function globalNotificationTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function renderGlobalNotifications(items) {
  const panel = document.getElementById("hr-global-notifications");
  const list = panel?.querySelector("[data-hr-notifications-list]");
  if (!list) return;

  list.innerHTML = items.length
    ? items.map((item) => `
        <li class="hr-notice hr-notice--${escapeNavText(item.type || "info")} hr-global-notifications__item${item.read ? " is-read" : ""}">
          <span class="hr-notice__dot hr-global-notifications__dot" aria-hidden="true"></span>
          <span class="hr-notice__message hr-global-notifications__message">${escapeNavText(item.message || "Notificación")}</span>
          <time class="hr-notice__time">${escapeNavText(globalNotificationTime(item.created_at))}</time>
        </li>
      `).join("")
    : '<li class="hr-global-notifications__empty">Sin notificaciones nuevas.</li>';
}

function toggleGlobalNotifications(forceOpen) {
  const panel = document.getElementById("hr-global-notifications");
  if (!panel) return;
  const open = typeof forceOpen === "boolean" ? forceOpen : panel.hidden;
  panel.hidden = !open;
  document.querySelectorAll("[data-hr-notifications-toggle]").forEach((button) => {
    button.setAttribute("aria-expanded", String(open));
  });
}

function attachGlobalNotificationListeners() {
  document.addEventListener("click", (event) => {
    const toggle = event.target.closest("[data-hr-notifications-toggle]");
    if (toggle) {
      event.preventDefault();
      event.stopPropagation();
      if (document.body.classList.contains("hr-global-menu-open")) toggleGlobalDrawer(false);
      toggleGlobalNotifications();
      return;
    }

    if (event.target.closest("[data-hr-notifications-close]")) {
      toggleGlobalNotifications(false);
      return;
    }

    const panel = document.getElementById("hr-global-notifications");
    if (panel && !panel.hidden && !event.target.closest("#hr-global-notifications")) {
      toggleGlobalNotifications(false);
    }
  });
}

function roleListIncludesAdmin(rawRoles) {
  return String(rawRoles || "").split(",").map((role) => role.trim().toLowerCase()).includes("admin");
}

function setAdminNavigationVisibility(visible) {
  document.querySelectorAll("[data-admin-nav-link]").forEach((link) => {
    link.hidden = !visible;
  });
}

function setPermissionNavigationVisibility(permissionKey, visible) {
  document.querySelectorAll("[data-permission-nav-link]").forEach((link) => {
    if (link.dataset.permissionNavLink === permissionKey) link.hidden = !visible;
  });
}

window.HiddenRoomNavigation = window.HiddenRoomNavigation || {
  setAdminLinksVisible: setAdminNavigationVisibility,
  setPermissionLinksVisible: setPermissionNavigationVisibility,
};

async function hydrateGlobalSession() {
  if (document.body.classList.contains("db-body")) return;
  const sessionTargets = document.querySelectorAll("[data-hr-session]");
  const drawerTargets = document.querySelectorAll("[data-hr-drawer-session]");
  if (!sessionTargets.length && !drawerTargets.length) return;

  setGlobalAuthState("loading");

  try {
    const supabase = await getHiddenRoomSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user || null;
    if (!user) {
      sessionTargets.forEach((target) => {
        target.innerHTML = guestHeaderMarkup();
      });
      drawerTargets.forEach((target) => {
        target.innerHTML = guestHeaderMarkup(true);
      });
      sessionTargets.forEach((target) => { target.hidden = false; });
      drawerTargets.forEach((target) => { target.hidden = false; });
      setAdminNavigationVisibility(false);
      setPermissionNavigationVisibility("beats.upload", false);
      renderGlobalNotifications([]);
      toggleGlobalNotifications(false);
      return;
    }

    const { data: profile } = await supabase
      .from("users")
      .select("user_id,display_name,username,email,avatar_url,roles,ig_username")
      .eq("id", user.id)
      .maybeSingle();

    const permissionResult = await supabase.rpc("has_beats_upload_permission");
    let hasBeatUploadPermission = permissionResult.data;
    if (permissionResult.error) {
      const { data: permissionRows } = await supabase
        .from("user_permissions")
        .select("permission_key")
        .eq("user_id", user.id);
      hasBeatUploadPermission = (permissionRows || [])
        .map((row) => String(row.permission_key || "").trim().toLowerCase())
        .includes("beats.upload");
    }
    setPermissionNavigationVisibility(
      "beats.upload",
      roleListIncludesAdmin(profile?.roles) || Boolean(hasBeatUploadPermission),
    );

    const notificationTargets = [user.id, profile?.user_id].filter(Boolean).map(String);
    let notifications = [];
    if (notificationTargets.length) {
      const { data } = await supabase
        .from("notifications")
        .select("id,message,type,created_at,read,user_id")
        .in("user_id", notificationTargets)
        .order("created_at", { ascending: false })
        .limit(25);
      notifications = data || [];
    }
    const unread = notifications.filter((item) => !item.read).length;
    let canSeeAdminNav = roleListIncludesAdmin(profile?.roles);
    if (!canSeeAdminNav) {
      const { data: academiaPermissionRows } = await supabase
        .from("user_permissions")
        .select("permission_key")
        .eq("user_id", user.id);
      canSeeAdminNav = (academiaPermissionRows || [])
        .map((row) => String(row.permission_key || "").trim().toLowerCase())
        .includes("academia.admin");
    }
    setAdminNavigationVisibility(canSeeAdminNav);
    globalSessionSnapshot = { profile, user, notifications, unread };

    sessionTargets.forEach((target) => {
      target.innerHTML = authenticatedHeaderMarkup(profile, user, unread);
    });
    drawerTargets.forEach((target) => {
      target.innerHTML = authenticatedHeaderMarkup(profile, user, unread, true);
    });
    sessionTargets.forEach((target) => { target.hidden = false; });
    drawerTargets.forEach((target) => { target.hidden = false; });
    setGlobalAuthState("authenticated");
    renderGlobalNotifications(notifications);
    showGlobalInstagramUsernamePrompt(profile, user, supabase);
  } catch (error) {
    setAdminNavigationVisibility(false);
    setPermissionNavigationVisibility("beats.upload", false);
    sessionTargets.forEach((target) => {
      target.innerHTML = guestHeaderMarkup();
      target.hidden = false;
    });
    drawerTargets.forEach((target) => {
      target.innerHTML = guestHeaderMarkup(true);
      target.hidden = false;
    });
    console.info("[HR] No fue posible hidratar la sesión global:", error?.message || error);
  }
}

async function hydrateGlobalInstagramUsernamePrompt() {
  try {
    const supabase = await getHiddenRoomSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("users")
      .select("id,display_name,username,email,ig_username")
      .eq("id", user.id)
      .maybeSingle();

    showGlobalInstagramUsernamePrompt(profile, user, supabase);
  } catch (error) {
    console.info("[HR] No fue posible validar Instagram global:", error?.message || error);
  }
}
async function attachGlobalSessionSync() {
  if (document.body.classList.contains("db-body")) return;

  try {
    const supabase = await getHiddenRoomSupabaseClient();
    supabase.auth.onAuthStateChange(() => {
      window.setTimeout(hydrateGlobalSession, 0);
      window.setTimeout(hydrateGlobalInstagramUsernamePrompt, 0);
    });
  } catch (error) {
    console.info("[HR] No fue posible sincronizar la sesión global:", error?.message || error);
  }
}

let globalDrawerScrollY = 0;
let globalDrawerScrollLocked = false;
let globalDrawerBodyStyles = null;

function lockGlobalDrawerScroll() {
  if (globalDrawerScrollLocked) return;

  globalDrawerScrollY = window.scrollY;
  globalDrawerBodyStyles = {
    position: document.body.style.position,
    top: document.body.style.top,
    right: document.body.style.right,
    left: document.body.style.left,
    width: document.body.style.width,
  };
  globalDrawerScrollLocked = true;
  document.documentElement.classList.add("hr-scroll-locked");
  document.body.style.position = "fixed";
  document.body.style.top = `-${globalDrawerScrollY}px`;
  document.body.style.right = "0";
  document.body.style.left = "0";
  document.body.style.width = "100%";
}

function syncGlobalOverlayState() {
  const globalOpen = document.body.classList.contains("hr-global-menu-open");
  const portalOpen = document.body.classList.contains("hr-portal-menu-open");
  document.body.classList.toggle("hr-overlay-open", globalOpen || portalOpen);
}

/**
 * Close only persistent global overlays and release the drawer's scroll lock.
 * This is intentionally idempotent so SPA navigation and nav rerenders can
 * call it even when the drawer is already closed or partially replaced.
 */
function releaseGlobalOverlayState() {
  const drawer = document.getElementById("hr-global-drawer");
  const backdrop = document.querySelector(".hr-global-drawer__backdrop");
  const toggle = document.querySelector(".hr-nav__mobile-toggle");
  const instagramGate = document.getElementById("hr-instagram-username-gate");
  const html = document.documentElement;
  const body = document.body;
  const staleBodyScrollMatch = body.style.top.match(/^-([\d.]+)px$/);
  const hadStaleLock = html.classList.contains("hr-scroll-locked")
    || body.classList.contains("hr-global-menu-open")
    || (body.style.position === "fixed" && Boolean(staleBodyScrollMatch));

  if (drawer) {
    drawer.hidden = true;
    drawer.setAttribute("aria-hidden", "true");
  }
  if (backdrop) backdrop.hidden = true;
  if (toggle) toggle.setAttribute("aria-expanded", "false");
  body.classList.remove("hr-global-menu-open");
  syncGlobalOverlayState();
  html.classList.remove("hr-scroll-locked");

  if (globalDrawerScrollLocked || hadStaleLock) {
    const restoreY = globalDrawerScrollLocked
      ? globalDrawerScrollY
      : staleBodyScrollMatch
        ? Math.max(0, Number.parseFloat(staleBodyScrollMatch[1]) || 0)
        : null;
    const originalStyles = globalDrawerBodyStyles;
    body.style.position = originalStyles?.position ?? "";
    body.style.top = originalStyles?.top ?? "";
    body.style.right = originalStyles?.right ?? "";
    body.style.left = originalStyles?.left ?? "";
    body.style.width = originalStyles?.width ?? "";
    globalDrawerScrollLocked = false;
    globalDrawerBodyStyles = null;
    if (restoreY !== null) window.scrollTo(0, restoreY);
  }

  if (instagramGate) {
    instagramGate.remove();
    instagramUsernamePromptOpen = false;
  }
}

window.releaseGlobalOverlayState = releaseGlobalOverlayState;

function toggleGlobalDrawer(forceOpen) {
  const drawer = document.getElementById("hr-global-drawer");
  const backdrop = document.querySelector(".hr-global-drawer__backdrop");
  const toggle = document.querySelector(".hr-nav__mobile-toggle");
  if (!drawer || !backdrop || !toggle) return;

  const open = typeof forceOpen === "boolean"
    ? forceOpen
    : drawer.getAttribute("aria-hidden") === "true";

  drawer.hidden = !open;
  if (open) drawer.scrollTop = 0;
  backdrop.hidden = !open;
  drawer.setAttribute("aria-hidden", String(!open));
  toggle.setAttribute("aria-expanded", String(open));
  document.body.classList.toggle("hr-global-menu-open", open);
  if (open) lockGlobalDrawerScroll();
  else releaseGlobalOverlayState();
  syncGlobalOverlayState();

  if (open) drawer.querySelector(".hr-global-drawer__close")?.focus();
  else toggle.focus();
}

const HR_BEAT_PLAYER_STORAGE_KEY = "hr_global_beat_player_clean";
const HR_WAVESURFER_URL = "/assets/vendor/wavesurfer.esm.js";
let hrWaveSurferModulePromise = null;
let hrWaveSurfer = null;
let hrWaveSurferSrc = "";
let hrWaveSurferReady = false;
let hrWaveSurferFailed = false;
let hrCurrentBeatDetail = null;
let hrGlobalBeatPlayerHydrated = false;
let hrBeatPlayerFullscreenPlaceholder = null;
let hrBeatPlayerFullscreenLastFocus = null;
let hrBeatAudioContext = null;
let hrBeatAnalyser = null;
let hrBeatAudioSource = null;
let hrBeatAnalyserAudio = null;
let hrBeatVisualizerFrame = 0;
let hrBeatVisualizerResizeObserver = null;
let hrBeatVisualizerFrequencyData = null;
let hrBeatVisualizerEnergy = 0;
let hrBeatVisualizerDisplayValues = [];
let hrBeatVisualizerPalette = { hue: 195, saturation: 69 };

function shouldRenderGlobalBeatPlayer() {
  const path = window.location.pathname;
  const excludedGames = path.includes("/minijuegos/flappy_") || path.includes("/minijuegos/gol_gana/");
  return !excludedGames;
}

const HR_WAVEFORM_FALLBACK_BARS = [
  22, 36, 48, 30, 62, 78, 44, 68, 92, 56, 38, 72, 84, 46, 28, 58,
  74, 96, 64, 42, 30, 52, 80, 68, 40, 26, 58, 88, 72, 48, 34, 64,
  82, 54, 30, 46, 70, 94, 62, 38, 24, 50, 76, 58, 34, 22,
];

function globalWaveformFallbackMarkup() {
  return `<div class="hr-beat-player__wave-fallback" aria-hidden="true">
    ${HR_WAVEFORM_FALLBACK_BARS.map((height) => `<span style="--hr-wave-bar-height:${height}%"></span>`).join("")}
  </div>`;
}

function setGlobalWaveformMode(mode = "fallback") {
  const waveform = document.getElementById("beat-player-waveform");
  if (!waveform) return;
  waveform.dataset.mode = mode;
  const fallback = waveform.querySelector(".hr-beat-player__wave-fallback");
  if (fallback) fallback.hidden = mode === "wave";
}

function globalBeatPlayerArtMarkup(cover = "") {
  const safeCover = String(cover || "").trim();
  return safeCover
    ? `<img src="${escapeNavText(safeCover)}" alt="" onerror="this.hidden=true;this.parentElement.classList.remove('has-image')"><span class="hr-beat-player__art-icon" aria-hidden="true">&#9658;</span>`
    : '<span>HR</span><span class="hr-beat-player__art-icon" aria-hidden="true">&#9658;</span>';
}

function beatPlayerAudioContextConstructor() {
  return window.AudioContext || window.webkitAudioContext || null;
}

function setGlobalBeatPlayerColor(value) {
  const safeValue = /^#[0-9a-f]{6}$/i.test(String(value || "")) ? String(value) : "#7cd0e9";
  const red = Number.parseInt(safeValue.slice(1, 3), 16) / 255;
  const green = Number.parseInt(safeValue.slice(3, 5), 16) / 255;
  const blue = Number.parseInt(safeValue.slice(5, 7), 16) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;
  const delta = max - min;
  let hue = 0;
  if (delta) {
    if (max === red) hue = 60 * (((green - blue) / delta) % 6);
    else if (max === green) hue = 60 * ((blue - red) / delta + 2);
    else hue = 60 * ((red - green) / delta + 4);
  }
  if (hue < 0) hue += 360;
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
  const roundedHue = Math.round(hue);
  const roundedSaturation = Math.round(saturation * 100);
  const tone = (toneLightness, saturationFactor = 1) => {
    const toneSaturation = Math.round(Math.max(0, Math.min(100, roundedSaturation * saturationFactor)));
    return `hsl(${roundedHue}, ${toneSaturation}%, ${toneLightness}%)`;
  };
  const fullscreen = document.getElementById("hr-beat-player-fullscreen");
  hrBeatVisualizerPalette = { hue: roundedHue, saturation: roundedSaturation };
  if (!fullscreen) return;
  fullscreen.style.setProperty("--hr-player-color-deep", tone(7, .42));
  fullscreen.style.setProperty("--hr-player-color-dark", tone(12, .58));
  fullscreen.style.setProperty("--hr-player-color-panel", tone(18, .72));
  fullscreen.style.setProperty("--hr-player-color-mid", tone(29, .82));
  fullscreen.style.setProperty("--hr-player-color-line", tone(48, 1));
  fullscreen.style.setProperty("--hr-player-color-muted", tone(62, .86));
  fullscreen.style.setProperty("--hr-player-color-accent", tone(74, 1.04));
  fullscreen.style.setProperty("--hr-player-color-bright", tone(90, .92));
  fullscreen.style.setProperty("--hr-player-accent", tone(74, 1.04));
  if (hrWaveSurfer?.setOptions) {
    hrWaveSurfer.setOptions({
      waveColor: `hsla(${roundedHue}, ${Math.round(roundedSaturation * .62)}%, 66%, .42)`,
      progressColor: tone(52, 1),
      cursorColor: tone(90, .92),
    });
  }
}

function ensureBeatPlayerAudioGraph(audio) {
  if (!audio) return false;
  const AudioContextConstructor = beatPlayerAudioContextConstructor();
  if (!AudioContextConstructor) return false;

  if (!hrBeatAudioContext || hrBeatAnalyserAudio !== audio) {
    try {
      audio.crossOrigin = "anonymous";
      hrBeatAudioContext = new AudioContextConstructor();
      hrBeatAnalyser = hrBeatAudioContext.createAnalyser();
      hrBeatAnalyser.fftSize = 512;
      hrBeatAnalyser.smoothingTimeConstant = 0.82;
      hrBeatAudioSource = hrBeatAudioContext.createMediaElementSource(audio);
      hrBeatAudioSource.connect(hrBeatAnalyser);
      hrBeatAnalyser.connect(hrBeatAudioContext.destination);
      hrBeatAnalyserAudio = audio;
      hrBeatVisualizerFrequencyData = new Uint8Array(hrBeatAnalyser.frequencyBinCount);
    } catch {
      hrBeatAudioContext = null;
      hrBeatAnalyser = null;
      hrBeatAudioSource = null;
      hrBeatAnalyserAudio = null;
      hrBeatVisualizerFrequencyData = null;
      return false;
    }
  }

  if (hrBeatAudioContext.state === "suspended") hrBeatAudioContext.resume().catch(() => {});
  return Boolean(hrBeatAnalyser);
}

function resizeBeatPlayerVisualizerCanvas(canvas) {
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const pixelWidth = Math.max(1, Math.round(width * dpr));
  const pixelHeight = Math.max(1, Math.round(height * dpr));
  if (canvas.width === pixelWidth && canvas.height === pixelHeight) return;
  canvas.width = pixelWidth;
  canvas.height = pixelHeight;
  canvas.style.setProperty("--hr-canvas-dpr", String(dpr));
  canvas.getContext("2d")?.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function resizeBeatPlayerVisualizers() {
  document.querySelectorAll("#beat-player-fullscreen-visualizer, #beat-player-fullscreen-lcd-visualizer")
    .forEach(resizeBeatPlayerVisualizerCanvas);
}

function beatPlayerSpectrumValue(data, index, count) {
  if (!data?.length || !hrBeatAudioContext || !hrBeatAnalyser) return 0;
  const minFrequency = 30;
  const maxFrequency = Math.min(16000, hrBeatAudioContext.sampleRate / 2);
  const minBin = Math.max(1, Math.floor((minFrequency / hrBeatAudioContext.sampleRate) * hrBeatAnalyser.fftSize));
  const maxBin = Math.min(data.length - 1, Math.ceil((maxFrequency / hrBeatAudioContext.sampleRate) * hrBeatAnalyser.fftSize));
  const start = Math.floor(minBin * Math.pow(maxBin / minBin, index / count));
  const end = Math.max(start + 1, Math.ceil(minBin * Math.pow(maxBin / minBin, (index + 1) / count)));
  let total = 0;
  let samples = 0;
  for (let bin = start; bin <= Math.min(maxBin, end); bin += 1) {
    total += data[bin];
    samples += 1;
  }
  return samples ? total / samples / 255 : 0;
}

function beatPlayerAmbientSpectrumValue(data, index, count) {
  if (!data?.length || !hrBeatAudioContext || !hrBeatAnalyser) return 0;
  const minFrequency = 30;
  const maxFrequency = Math.min(16000, hrBeatAudioContext.sampleRate / 2);
  const minBin = Math.max(1, Math.floor((minFrequency / hrBeatAudioContext.sampleRate) * hrBeatAnalyser.fftSize));
  const maxBin = Math.min(data.length - 1, Math.ceil((maxFrequency / hrBeatAudioContext.sampleRate) * hrBeatAnalyser.fftSize));
  const start = Math.floor(minBin * Math.pow(maxBin / minBin, index / count));
  const end = Math.max(start + 1, Math.ceil(minBin * Math.pow(maxBin / minBin, (index + 1) / count)));
  let peak = 0;
  let average = 0;
  let samples = 0;
  for (let bin = start; bin <= Math.min(maxBin, end); bin += 1) {
    const value = data[bin] / 255;
    peak = Math.max(peak, value);
    average += value;
    samples += 1;
  }
  if (!samples) return 0;
  const bandAverage = average / samples;
  const lowFrequencyWeight = 1.06 - (index / Math.max(1, count - 1)) * 0.18;
  return Math.min(1, Math.pow(peak, 0.72) * 0.92 * lowFrequencyWeight + Math.pow(bandAverage, 0.72) * 0.16);
}

function drawBeatPlayerSpectrum(canvas, data, mode = "top") {
  if (!canvas) return 0;
  resizeBeatPlayerVisualizerCanvas(canvas);
  const context = canvas.getContext("2d");
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (!context || !width || !height) return 0;

  context.clearRect(0, 0, width, height);

  const count = mode === "lcd"
    ? 32
    : Math.max(78, Math.min(110, Math.round(width / 3.4)));
  const gap = mode === "lcd" ? 2 : 1;
  const barWidth = mode === "lcd"
    ? Math.max(1, (width - (count - 1) * gap) / count)
    : Math.min(2.4, Math.max(1, ((width - (count - 1) * gap) / count) * 0.48));
  const maxHeight = mode === "lcd" ? Math.max(4, height - 5) : Math.max(6, height - 2);
  let energyTotal = 0;
  if (mode !== "lcd" && hrBeatVisualizerDisplayValues.length !== count) {
    hrBeatVisualizerDisplayValues = Array.from({ length: count }, () => 0);
  }
  for (let index = 0; index < count; index += 1) {
    const rawValue = mode === "lcd"
      ? beatPlayerSpectrumValue(data, index, count)
      : beatPlayerAmbientSpectrumValue(data, index, count);
    const value = mode === "lcd"
      ? rawValue
      : Math.max(rawValue, hrBeatVisualizerDisplayValues[index] * 0.92);
    if (mode !== "lcd") hrBeatVisualizerDisplayValues[index] = value;
    energyTotal += value;
    const barHeight = Math.max(0, value * maxHeight);
    const x = index * (barWidth + gap);
    const segmentHeight = mode === "lcd" ? 3 : 4;
    const segmentGap = mode === "lcd" ? 2 : 2;
    if (mode === "lcd") {
      const alpha = 0.16 + value * 0.55;
      const bass = index / count < 0.5;
      context.fillStyle = bass
        ? `hsla(${hrBeatVisualizerPalette.hue}, ${Math.min(100, hrBeatVisualizerPalette.saturation * 1.04)}%, 48%, ${alpha})`
        : `hsla(${hrBeatVisualizerPalette.hue}, ${Math.round(hrBeatVisualizerPalette.saturation * .68)}%, 66%, ${alpha})`;
      for (let y = height - 3; y > height - 3 - barHeight; y -= segmentHeight + segmentGap) {
        context.fillRect(x, Math.max(0, y - segmentHeight), barWidth, segmentHeight);
      }
    } else if (barHeight > 0) {
      const alpha = 0.28 + value * 0.34;
      const bass = index / count < 0.26;
      context.fillStyle = bass
        ? `hsla(${hrBeatVisualizerPalette.hue}, ${Math.round(hrBeatVisualizerPalette.saturation * .82)}%, 54%, ${alpha})`
        : `hsla(${hrBeatVisualizerPalette.hue}, ${Math.round(hrBeatVisualizerPalette.saturation * .64)}%, 62%, ${alpha})`;
      context.fillRect(x, height - barHeight, barWidth, barHeight);
    }
  }
  if (mode !== "lcd") {
    const verticalFade = context.createLinearGradient(0, 0, 0, height);
    const { hue, saturation } = hrBeatVisualizerPalette;
    verticalFade.addColorStop(0, `hsla(${hue}, ${Math.round(saturation * .6)}%, 54%, .01)`);
    verticalFade.addColorStop(0.45, `hsla(${hue}, ${Math.round(saturation * .7)}%, 58%, .18)`);
    verticalFade.addColorStop(0.82, `hsla(${hue}, ${Math.round(saturation * .82)}%, 54%, .7)`);
    verticalFade.addColorStop(1, `hsla(${hue}, ${Math.round(saturation * .82)}%, 54%, 1)`);
    context.globalCompositeOperation = "destination-in";
    context.fillStyle = verticalFade;
    context.fillRect(0, 0, width, height);
    context.globalCompositeOperation = "source-over";
  }
  return energyTotal / count;
}

function drawBeatPlayerVisualizerFrame() {
  const data = hrBeatAnalyser && hrBeatVisualizerFrequencyData
    ? (hrBeatAnalyser.getByteFrequencyData(hrBeatVisualizerFrequencyData), hrBeatVisualizerFrequencyData)
    : null;
  const topCanvas = document.getElementById("beat-player-fullscreen-visualizer");
  const lcdCanvas = document.getElementById("beat-player-fullscreen-lcd-visualizer");
  const topEnergy = drawBeatPlayerSpectrum(topCanvas, data, "top");
  const lcdEnergy = drawBeatPlayerSpectrum(lcdCanvas, data, "lcd");
  const targetEnergy = Math.min(1, topEnergy * 0.7 + lcdEnergy * 0.3);
  hrBeatVisualizerEnergy += (targetEnergy - hrBeatVisualizerEnergy) * 0.18;
  const screen = document.querySelector(".hr-beat-player-fullscreen__screen");
  if (screen) {
    screen.style.setProperty("--hr-audio-energy", hrBeatVisualizerEnergy.toFixed(3));
    screen.style.setProperty("--hr-audio-glow", `${12 + Math.round(hrBeatVisualizerEnergy * 28)}px`);
    screen.style.setProperty("--hr-audio-glow-alpha", `${0.1 + hrBeatVisualizerEnergy * 0.18}`);
  }
}

function startBeatPlayerVisualizer() {
  if (hrBeatVisualizerFrame) return;
  const tick = () => {
    drawBeatPlayerVisualizerFrame();
    const fullscreen = document.getElementById("hr-beat-player-fullscreen");
    if (!fullscreen?.hidden || isBeatPlayerPlaying()) {
      hrBeatVisualizerFrame = window.requestAnimationFrame(tick);
    } else {
      hrBeatVisualizerFrame = 0;
    }
  };
  hrBeatVisualizerFrame = window.requestAnimationFrame(tick);
}

function setupBeatPlayerVisualizers(audio) {
  resizeBeatPlayerVisualizers();
  if (hrBeatVisualizerResizeObserver) hrBeatVisualizerResizeObserver.disconnect();
  if (window.ResizeObserver) {
    hrBeatVisualizerResizeObserver = new ResizeObserver(resizeBeatPlayerVisualizers);
    document.querySelectorAll(".hr-beat-player-fullscreen__visualizer, .hr-beat-player-fullscreen__lcd-visualizer")
      .forEach((element) => hrBeatVisualizerResizeObserver.observe(element));
  }
  window.addEventListener("resize", resizeBeatPlayerVisualizers);
  audio.addEventListener("play", () => {
    ensureBeatPlayerAudioGraph(audio);
    startBeatPlayerVisualizer();
  });
  audio.addEventListener("pause", () => {
    if (!document.getElementById("hr-beat-player-fullscreen")?.hidden) startBeatPlayerVisualizer();
  });
}

function renderGlobalBeatPlayer() {
  if (!shouldRenderGlobalBeatPlayer()) return "";
  document.body.classList.add("hr-has-beat-player");
  return `
    <aside class="hr-beat-player is-empty" id="hr-beat-player" aria-label="Reproductor Beat Store" data-state="idle">
      <button class="hr-beat-player__art" id="beat-player-art" type="button" data-beat-player-toggle aria-label="Reproducir preview" aria-pressed="false"><span>HR</span><span class="hr-beat-player__art-icon" aria-hidden="true">&#9658;</span></button>
      <div class="hr-beat-player__meta">
        <strong id="player-title">Selecciona un beat</strong>
        <span id="player-detail"></span>
      </div>
      <button class="hr-beat-player__more" type="button" data-beat-player-more aria-label="Opciones del reproductor" aria-expanded="false" aria-controls="beat-player-menu">...</button>
      <button class="hr-beat-player__fullscreen" type="button" data-beat-player-fullscreen aria-label="Abrir reproductor en pantalla completa" aria-controls="hr-beat-player-fullscreen" disabled>&#x26F6;</button>
      <div class="hr-beat-player__menu" id="beat-player-menu" hidden>
        <a href="/store/beat_store/">Ir a Beat Store</a>
      </div>
      <div class="hr-beat-player__controls">
        <div class="hr-beat-player__wave-wrap">
          <div class="hr-beat-player__wave" id="beat-player-waveform" role="slider" aria-label="Progreso del preview" aria-valuemin="0" aria-valuemax="0" aria-valuenow="0" aria-valuetext="0:00 de 0:00" tabindex="0">${globalWaveformFallbackMarkup()}</div>
          <input class="hr-beat-player__seek hr-beat-player__seek--fallback" id="beat-player-seek" type="range" min="0" max="1000" value="0" step="1" aria-label="Progreso del preview" disabled hidden>
        </div>
        <span class="hr-beat-player__time" id="beat-player-time">0:00 / 0:00</span>
        <button class="hr-beat-player__mute" type="button" data-beat-player-mute aria-label="Silenciar preview" aria-pressed="false">VOL</button>
        <input class="hr-beat-player__volume" id="beat-player-volume" type="range" min="0" max="1" value="1" step="0.01" aria-label="Volumen del preview">
      </div>
      <audio id="beat-audio" preload="metadata" crossorigin="anonymous"></audio>
    </aside>
    <section class="hr-beat-player-fullscreen" id="hr-beat-player-fullscreen" hidden aria-hidden="true">
      <button class="hr-beat-player-fullscreen__backdrop" type="button" data-beat-player-fullscreen-close aria-label="Cerrar reproductor en pantalla completa"></button>
      <div class="hr-beat-player-fullscreen__dialog" role="dialog" aria-modal="true" aria-labelledby="beat-player-fullscreen-title" tabindex="-1">
        <header class="hr-beat-player-fullscreen__header">
          <div class="hr-beat-player-fullscreen__brand">
            <span>Hidden Room</span>
            <strong>Beat Store</strong>
          </div>
          <span class="hr-beat-player-fullscreen__serial" id="beat-player-fullscreen-genre" aria-hidden="true">GÉNERO</span>
          <button class="hr-beat-player-fullscreen__close" type="button" data-beat-player-fullscreen-close aria-label="Cerrar reproductor en pantalla completa">&times;</button>
          <div class="hr-beat-player-fullscreen__appearance" aria-label="Apariencia del reproductor">
            <label>
              <span>TEMA</span>
              <select id="beat-player-fullscreen-theme" aria-label="Tema del reproductor">
                <option value="y2k">Y2K</option>
              </select>
            </label>
            <label>
              <span>COLOR</span>
              <input id="beat-player-fullscreen-color" type="color" value="#7cd0e9" aria-label="Color del reproductor">
            </label>
          </div>
        </header>
        <div class="hr-beat-player-fullscreen__content">
          <div class="hr-beat-player-fullscreen__visualizer" aria-hidden="true">
            <canvas id="beat-player-fullscreen-visualizer"></canvas>
          </div>
          <div class="hr-beat-player-fullscreen__screen">
            <div class="hr-beat-player-fullscreen__screen-top"><span>LCD / STEREO</span><span>PREVIEW</span></div>
            <div class="hr-beat-player-fullscreen__screen-main">
              <button class="hr-beat-player-fullscreen__art hr-beat-player__art" id="beat-player-fullscreen-art" type="button" data-beat-player-fullscreen-toggle aria-label="Reproducir preview" aria-pressed="false" disabled><span>HR</span><span class="hr-beat-player__art-icon" aria-hidden="true">&#9658;</span></button>
              <div class="hr-beat-player-fullscreen__meta">
                <span class="hr-beat-player-fullscreen__label">REPRODUCTOR</span>
                <h2 id="beat-player-fullscreen-title">Selecciona un beat</h2>
                <p id="beat-player-fullscreen-producer"></p>
                <div class="hr-beat-player-fullscreen__stats"><span id="beat-player-fullscreen-bpm">-- BPM</span><span id="beat-player-fullscreen-key">KEY --</span></div>
              </div>
            </div>
            <div class="hr-beat-player-fullscreen__wave-slot" id="beat-player-fullscreen-wave-slot"></div>
            <div class="hr-beat-player-fullscreen__lcd-visualizer" aria-hidden="true">
              <canvas id="beat-player-fullscreen-lcd-visualizer"></canvas>
            </div>
            <div class="hr-beat-player-fullscreen__footer">
              <span id="beat-player-fullscreen-time">0:00 / 0:00</span>
              <span>Preview</span>
            </div>
          </div>
          <div class="hr-beat-player-fullscreen__transport" aria-label="Control central de reproducción">
            <button class="hr-beat-player-fullscreen__nav" type="button" data-beat-player-restart aria-label="Regresar el beat al inicio" disabled>&#9198;</button>
            <button class="hr-beat-player-fullscreen__play" type="button" data-beat-player-fullscreen-toggle aria-label="Reproducir preview" aria-pressed="false" disabled><span class="hr-beat-player__art-icon" aria-hidden="true">&#9658;</span></button>
            <button class="hr-beat-player-fullscreen__nav" type="button" data-beat-player-next aria-label="Reproducir el siguiente beat" disabled>&#9197;</button>
          </div>
          <div class="hr-beat-player-fullscreen__hardware-row">
            <button type="button" disabled aria-label="Shuffle no disponible">&#8646;</button>
            <button type="button" disabled aria-label="Repeat no disponible">&#8635;</button>
            <button class="hr-beat-player__mute" type="button" data-beat-player-mute aria-label="Silenciar preview" aria-pressed="false">VOL</button>
            <input class="hr-beat-player__volume" id="beat-player-fullscreen-volume" type="range" min="0" max="1" value="1" step="0.01" aria-label="Volumen del preview">
          </div>
          <button class="hr-beat-player-fullscreen__buy hr-beat-player__buy" type="button" data-beat-player-buy disabled>BUY BEAT</button>
        </div>
      </div>
    </section>
  `;
}

function hydrateGlobalBeatPlayer() {
  const player = document.getElementById("hr-beat-player");
  const fallbackAudio = document.getElementById("beat-audio");
  if (!player || !fallbackAudio) return;

  const toggles = player.querySelectorAll("[data-beat-player-toggle]");
  const seek = document.getElementById("beat-player-seek");
  const time = document.getElementById("beat-player-time");
  const mutes = document.querySelectorAll("[data-beat-player-mute]");
  const volumes = document.querySelectorAll("#beat-player-volume, #beat-player-fullscreen-volume");
  const waveform = document.getElementById("beat-player-waveform");
  const more = player.querySelector("[data-beat-player-more]");
  const menu = document.getElementById("beat-player-menu");
  const fullscreen = document.getElementById("hr-beat-player-fullscreen");
  const fullscreenDialog = fullscreen?.querySelector(".hr-beat-player-fullscreen__dialog");
  const fullscreenWaveSlot = document.getElementById("beat-player-fullscreen-wave-slot");
  const fullscreenWaveWrap = player.querySelector(".hr-beat-player__wave-wrap");
  const fullscreenToggles = fullscreen?.querySelectorAll("[data-beat-player-fullscreen-toggle]") || [];
  const fullscreenClose = fullscreen?.querySelectorAll("[data-beat-player-fullscreen-close]") || [];
  const fullscreenRestart = fullscreen?.querySelector("[data-beat-player-restart]");
  const fullscreenNext = fullscreen?.querySelector("[data-beat-player-next]");
  const fullscreenTheme = document.getElementById("beat-player-fullscreen-theme");
  const fullscreenColor = document.getElementById("beat-player-fullscreen-color");
  const buyButtons = document.querySelectorAll("[data-beat-player-buy]");

  fallbackAudio.removeAttribute("controls");
  fallbackAudio.crossOrigin = "anonymous";
  fallbackAudio.setAttribute("controlsList", "nodownload noplaybackrate");
  fallbackAudio.addEventListener("contextmenu", (event) => event.preventDefault());

  const sync = () => syncGlobalBeatPlayerControls(toggles, seek, time, mutes, volumes, waveform);
  setupBeatPlayerVisualizers(fallbackAudio);
  more?.addEventListener("click", (event) => {
    event.preventDefault();
    const open = Boolean(menu?.hidden);
    if (menu) menu.hidden = !open;
    more.setAttribute("aria-expanded", String(open));
  });
  document.addEventListener("click", (event) => {
    if (!menu || menu.hidden) return;
    if (event.target.closest("[data-beat-player-more], #beat-player-menu")) return;
    menu.hidden = true;
    more?.setAttribute("aria-expanded", "false");
  });
  toggles.forEach((toggle) => toggle.addEventListener("click", () => {
    if (!getBeatPlayerSrc()) {
      window.location.assign("/store/beat_store/");
      return;
    }
    if (fallbackAudio.paused) fallbackAudio.play().catch(() => {});
    else fallbackAudio.pause();
  }));
  buyButtons.forEach((button) => button.addEventListener("click", () => {
    const event = new CustomEvent("hr:beat-player-buy", {
      cancelable: true,
      detail: { beatId: button.dataset.beatId || "", trigger: button },
    });
    if (window.dispatchEvent(event)) window.location.assign("/store/beat_store/");
  }));
  player.addEventListener("click", (event) => {
    if (getBeatPlayerSrc()) return;
    event.preventDefault();
    event.stopPropagation();
    window.location.assign("/store/beat_store/");
  }, true);
  const openFullscreen = () => {
    if (!fullscreen || !getBeatPlayerSrc()) return;
    hrBeatPlayerFullscreenLastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (fullscreenWaveWrap && fullscreenWaveSlot) {
      if (!hrBeatPlayerFullscreenPlaceholder && fullscreenWaveWrap.parentElement) {
        hrBeatPlayerFullscreenPlaceholder = document.createComment("hr-beat-player-wave-placeholder");
        fullscreenWaveWrap.parentElement.insertBefore(hrBeatPlayerFullscreenPlaceholder, fullscreenWaveWrap);
      }
      if (fullscreenWaveWrap.parentElement !== fullscreenWaveSlot) fullscreenWaveSlot.appendChild(fullscreenWaveWrap);
    }
    fullscreen.hidden = false;
    fullscreen.setAttribute("aria-hidden", "false");
    document.body.classList.add("hr-beat-player-fullscreen-open");
    fullscreenDialog?.focus();
    resizeBeatPlayerVisualizers();
    startBeatPlayerVisualizer();
    window.requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
  };
  const closeFullscreen = () => {
    if (!fullscreen) return;
    if (fullscreenWaveWrap && hrBeatPlayerFullscreenPlaceholder?.parentNode) {
      hrBeatPlayerFullscreenPlaceholder.parentNode.insertBefore(fullscreenWaveWrap, hrBeatPlayerFullscreenPlaceholder);
    }
    fullscreen.hidden = true;
    fullscreen.setAttribute("aria-hidden", "true");
    document.body.classList.remove("hr-beat-player-fullscreen-open");
    window.requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
    hrBeatPlayerFullscreenLastFocus?.focus?.();
    hrBeatPlayerFullscreenLastFocus = null;
  };
  player.querySelector("[data-beat-player-fullscreen]")?.addEventListener("click", openFullscreen);
  fullscreenToggles.forEach((fullscreenToggle) => fullscreenToggle.addEventListener("click", () => {
    if (!fallbackAudio.src) return;
    if (fallbackAudio.paused) fallbackAudio.play().catch(() => {});
    else fallbackAudio.pause();
  }));
  fullscreenClose.forEach((control) => control.addEventListener("click", closeFullscreen));
  fullscreenTheme?.addEventListener("change", () => {
    if (fullscreen) fullscreen.dataset.theme = fullscreenTheme.value || "y2k";
  });
  fullscreenColor?.addEventListener("input", () => {
    setGlobalBeatPlayerColor(fullscreenColor.value);
  });
  if (fullscreen) fullscreen.dataset.theme = fullscreenTheme?.value || "y2k";
  if (fullscreenColor?.value) setGlobalBeatPlayerColor(fullscreenColor.value);
  fullscreenRestart?.addEventListener("click", () => {
    if (!fallbackAudio.src) return;
    if (hrWaveSurfer && hrWaveSurferReady) hrWaveSurfer.seekTo(0);
    else fallbackAudio.currentTime = 0;
    if (hrCurrentBeatDetail) hrCurrentBeatDetail.currentTime = 0;
    sync();
    persistGlobalBeatPlayerState();
    emitGlobalBeatPlayerState();
  });
  fullscreenNext?.addEventListener("click", () => {
    if (!fallbackAudio.src) return;
    window.dispatchEvent(new CustomEvent("hr:beat-player-next", {
      detail: {
        beatId: hrCurrentBeatDetail?.beatId || player.dataset.beatId || "",
        src: getBeatPlayerSrc(),
      },
    }));
  });
  document.addEventListener("keydown", (event) => {
    if (!fullscreen || fullscreen.hidden) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeFullscreen();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = [...fullscreen.querySelectorAll("button:not([disabled])")];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
  seek?.addEventListener("input", () => {
    if (!Number.isFinite(fallbackAudio.duration) || fallbackAudio.duration <= 0) return;
    fallbackAudio.currentTime = (Number(seek.value) / 1000) * fallbackAudio.duration;
    sync();
  });
  waveform?.addEventListener("keydown", (event) => {
    if (!hrWaveSurfer || !hrWaveSurferReady) return;
    const duration = hrWaveSurfer.getDuration() || 0;
    if (!duration) return;
    const step = event.key === "ArrowLeft" ? -5 : event.key === "ArrowRight" ? 5 : 0;
    if (!step) return;
    event.preventDefault();
    const next = Math.max(0, Math.min(duration, hrWaveSurfer.getCurrentTime() + step));
    hrWaveSurfer.seekTo(next / duration);
  });
  mutes.forEach((mute) => mute.addEventListener("click", () => {
    const muted = !getBeatPlayerMuted();
    setBeatPlayerMuted(muted);
    sync();
    emitGlobalBeatPlayerState();
  }));
  volumes.forEach((volume) => volume.addEventListener("input", () => {
    const next = Math.max(0, Math.min(1, Number(volume.value) || 0));
    setBeatPlayerVolume(next);
    setBeatPlayerMuted(next === 0);
    sync();
  }));

  try {
    sessionStorage.removeItem("hr_global_beat_player");
    const saved = JSON.parse(sessionStorage.getItem(HR_BEAT_PLAYER_STORAGE_KEY) || "null");
    if (saved?.src) setGlobalBeatPlayer(sanitizeBeatPlayerDetail(saved), { autoplay: false, restoreTime: true });
  } catch {
    sessionStorage.removeItem(HR_BEAT_PLAYER_STORAGE_KEY);
  }

  ["loadedmetadata", "durationchange", "timeupdate", "pause", "play", "waiting", "canplay", "ended"].forEach((eventName) => {
    fallbackAudio.addEventListener(eventName, () => {
      if (hrWaveSurfer) return;
      if (eventName === "waiting") player.dataset.state = "loading";
      if (eventName === "canplay") player.dataset.state = fallbackAudio.paused ? "paused" : "playing";
      if (eventName === "ended") {
        fallbackAudio.currentTime = 0;
        player.dataset.state = "ended";
      }
      sync();
      persistGlobalBeatPlayerState();
      emitGlobalBeatPlayerState();
    });
  });

  const resize = () => document.documentElement.style.setProperty("--hr-beat-player-offset", `${Math.ceil(player.getBoundingClientRect().height + 32)}px`);
  resize();
  if (window.ResizeObserver) new ResizeObserver(resize).observe(player);
  window.addEventListener("resize", resize);
  sync();
  emitGlobalBeatPlayerState();
}
function syncGlobalBeatPlayerControls(toggle, seek, time, mute, volume, waveform) {
  const fallbackAudio = document.getElementById("beat-audio");
  const player = document.getElementById("hr-beat-player");
  const duration = getBeatPlayerDuration();
  const current = getBeatPlayerCurrentTime();
  const isPlaying = isBeatPlayerPlaying();

  if (player && player.dataset.state !== "loading" && player.dataset.state !== "ended") {
    player.dataset.state = getBeatPlayerSrc() ? (isPlaying ? "playing" : "paused") : "idle";
  }
  const toggleControls = toggle ? (typeof toggle.length === "number" ? [...toggle] : [toggle]) : [];
  toggleControls.forEach((control) => {
    const icon = control.querySelector(".hr-beat-player__art-icon");
    if (icon) icon.innerHTML = isPlaying ? "&#10074;&#10074;" : "&#9658;";
    control.setAttribute("aria-label", isPlaying ? "Pausar preview" : "Reproducir preview");
    control.setAttribute("aria-pressed", String(isPlaying));
  });
  const fullscreenToggles = document.querySelectorAll("[data-beat-player-fullscreen-toggle]");
  const fullscreenOpen = document.querySelector("[data-beat-player-fullscreen]");
  const navigationControls = document.querySelectorAll("[data-beat-player-restart], [data-beat-player-next]");
  if (fullscreenOpen) fullscreenOpen.disabled = !getBeatPlayerSrc();
  navigationControls.forEach((control) => { control.disabled = !getBeatPlayerSrc(); });
  fullscreenToggles.forEach((fullscreenToggle) => {
    const icon = fullscreenToggle.querySelector(".hr-beat-player__art-icon");
    if (icon) icon.innerHTML = isPlaying ? "&#10074;&#10074;" : "&#9658;";
    fullscreenToggle.disabled = !getBeatPlayerSrc();
    fullscreenToggle.setAttribute("aria-label", isPlaying ? "Pausar preview" : "Reproducir preview");
    fullscreenToggle.setAttribute("aria-pressed", String(isPlaying));
  });
  if (seek) {
    seek.value = duration > 0 ? String(Math.round((current / duration) * 1000)) : "0";
    seek.disabled = duration <= 0;
    seek.style.setProperty("--hr-progress", `${duration > 0 ? (current / duration) * 100 : 0}%`);
  }
  if (waveform) {
    waveform.setAttribute("aria-valuemax", String(Math.round(duration)));
    waveform.setAttribute("aria-valuenow", String(Math.round(current)));
    waveform.setAttribute("aria-valuetext", `${formatGlobalBeatTime(current)} de ${formatGlobalBeatTime(duration)}`);
    waveform.style.setProperty("--hr-wave-progress", `${duration > 0 ? (current / duration) * 100 : 0}%`);
  }
  if (time) time.textContent = `${formatGlobalBeatTime(current)} / ${formatGlobalBeatTime(duration)}`;
  const fullscreenTime = document.getElementById("beat-player-fullscreen-time");
  if (fullscreenTime) fullscreenTime.textContent = `${formatGlobalBeatTime(current)} / ${formatGlobalBeatTime(duration)}`;
  const muteControls = mute ? (typeof mute.length === "number" ? [...mute] : [mute]) : [];
  muteControls.forEach((control) => {
    control.textContent = getBeatPlayerMuted() ? "MUTE" : "VOL";
    control.setAttribute("aria-pressed", String(getBeatPlayerMuted()));
  });
  const volumeControls = volume ? (typeof volume.length === "number" ? [...volume] : [volume]) : [];
  volumeControls.forEach((control) => {
    if (document.activeElement !== control) control.value = String(getBeatPlayerMuted() ? 0 : getBeatPlayerVolume());
  });
}
function formatGlobalBeatTime(value) {
  const seconds = Math.max(0, Math.floor(Number(value) || 0));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function emitGlobalBeatPlayerState() {
  window.HiddenRoomBeatPlayer = {
    src: getBeatPlayerSrc(),
    isPlaying: isBeatPlayerPlaying(),
    beatId: hrCurrentBeatDetail?.beatId || document.getElementById("hr-beat-player")?.dataset.beatId || "",
  };
  window.dispatchEvent(new CustomEvent("hr:beat-player-state", { detail: window.HiddenRoomBeatPlayer }));
}

function sanitizeBeatPlayerDetail(detail) {
  const clean = { ...(detail || {}) };
  if (/compra para descargar|compra el beat para descargarlo/i.test(String(clean.detail || ""))) clean.detail = "";
  return clean;
}

function setGlobalBeatPlayer(detail, options = {}) {
  detail = sanitizeBeatPlayerDetail(detail);
  const player = document.getElementById("hr-beat-player");
  const fallbackAudio = document.getElementById("beat-audio");
  const title = document.getElementById("player-title");
  const meta = document.getElementById("player-detail");
  const art = document.getElementById("beat-player-art");
  const fullscreenTitle = document.getElementById("beat-player-fullscreen-title");
  const fullscreenProducer = document.getElementById("beat-player-fullscreen-producer");
  const fullscreenGenre = document.getElementById("beat-player-fullscreen-genre");
  const fullscreenArt = document.getElementById("beat-player-fullscreen-art");
  const bpm = document.querySelectorAll("#beat-player-bpm, #beat-player-fullscreen-bpm");
  const key = document.querySelectorAll("#beat-player-key, #beat-player-fullscreen-key");
  const buyButtons = document.querySelectorAll("[data-beat-player-buy]");
  if (!detail?.src) return;
  hrCurrentBeatDetail = detail;
  hrBeatVisualizerDisplayValues = [];

  destroyBeatWaveform();
  setGlobalWaveformMode("loading");
  if (fallbackAudio) {
    fallbackAudio.pause();
    fallbackAudio.removeAttribute("controls");
    fallbackAudio.src = detail.src;
    fallbackAudio.load();
  }
  player?.classList.remove("is-empty");
  player?.classList.add("is-loaded");
  if (player) player.dataset.state = "loading";
  if (title) title.textContent = detail.title || "Beat Store";
  if (meta) meta.textContent = detail.detail || "";
  if (fullscreenTitle) fullscreenTitle.textContent = detail.title || "Beat Store";
  if (fullscreenProducer) fullscreenProducer.textContent = detail.detail || "";
  if (fullscreenGenre) fullscreenGenre.textContent = String(detail.genre || "GÉNERO").trim() || "GÉNERO";
  bpm.forEach((element) => { element.textContent = detail.bpm ? `${detail.bpm} BPM` : "-- BPM"; });
  key.forEach((element) => { element.textContent = detail.key ? `KEY ${detail.key}` : "KEY --"; });
  buyButtons.forEach((button) => {
    button.dataset.beatId = detail.beatId || "";
    button.disabled = !detail.beatId;
  });
  if (player) player.dataset.beatId = detail.beatId || "";
  if (art) {
    const cover = String(detail.cover || "").trim();
    art.innerHTML = globalBeatPlayerArtMarkup(cover);
    art.classList.toggle("has-image", Boolean(cover));
    if (fullscreenArt) {
      fullscreenArt.innerHTML = globalBeatPlayerArtMarkup(cover);
      fullscreenArt.classList.toggle("has-image", Boolean(cover));
    }
  }

  loadBeatFallbackAudio(detail, { ...options, keepWaveform: true });
  loadBeatWaveform(detail.src, { ...options, autoplay: false, media: fallbackAudio }).catch(() => {
    loadBeatFallbackAudio(detail, { ...options, keepCurrentAudio: true });
  });
}
function getWaveSurferModule() {
  if (!hrWaveSurferModulePromise) {
    hrWaveSurferModulePromise = import(HR_WAVESURFER_URL).then((module) => module.default || module.WaveSurfer || module);
  }
  return hrWaveSurferModulePromise;
}

async function loadBeatWaveform(src, options = {}) {
  const player = document.getElementById("hr-beat-player");
  const waveform = document.getElementById("beat-player-waveform");
  const seek = document.getElementById("beat-player-seek");
  if (!waveform) throw new Error("Waveform container missing");

  if (!options.media) destroyBeatWaveform();
  hrWaveSurferFailed = false;
  hrWaveSurferReady = false;
  hrWaveSurferSrc = src;
  waveform.hidden = false;
  setGlobalWaveformMode("loading");
  if (seek) seek.hidden = true;
  if (player) player.dataset.state = "loading";

  const WaveSurfer = await getWaveSurferModule();
  hrWaveSurfer = WaveSurfer.create({
    container: waveform,
    url: src,
    height: 38,
    waveColor: `hsla(${hrBeatVisualizerPalette.hue}, ${Math.round(hrBeatVisualizerPalette.saturation * .62)}%, 66%, .42)`,
    progressColor: `hsl(${hrBeatVisualizerPalette.hue}, ${Math.min(100, Math.round(hrBeatVisualizerPalette.saturation * 1.04))}%, 52%)`,
    cursorColor: `hsl(${hrBeatVisualizerPalette.hue}, ${Math.round(hrBeatVisualizerPalette.saturation * .92)}%, 90%)`,
    cursorWidth: 1,
    barWidth: 2,
    barGap: 2,
    barRadius: 2,
    normalize: true,
    interact: true,
    ...(options.media ? { media: options.media } : {}),
  });

  hrWaveSurfer.on("ready", () => {
    hrWaveSurferReady = true;
    setGlobalWaveformMode("wave");
    const restoreAt = Number(options.currentTime ?? (options.restoreTime ? hrCurrentBeatDetail?.currentTime : 0));
    if (Number.isFinite(restoreAt) && restoreAt > 0 && hrWaveSurfer.getDuration()) {
      hrWaveSurfer.seekTo(Math.max(0, restoreAt) / hrWaveSurfer.getDuration());
    }
    if (player) player.dataset.state = isBeatPlayerPlaying() ? "playing" : "paused";
    syncGlobalBeatPlayerControls(
      player?.querySelectorAll("[data-beat-player-toggle]"),
      seek,
      document.getElementById("beat-player-time"),
      document.querySelectorAll("[data-beat-player-mute]"),
      document.querySelectorAll("#beat-player-volume, #beat-player-fullscreen-volume"),
      waveform,
    );
    emitGlobalBeatPlayerState();

  });
  ["audioprocess", "seeking", "interaction", "play", "pause"].forEach((eventName) => {
    hrWaveSurfer.on(eventName, () => {
      if (player && player.dataset.state !== "loading") player.dataset.state = hrWaveSurfer.isPlaying() ? "playing" : "paused";
      syncGlobalBeatPlayerControls(
        player?.querySelectorAll("[data-beat-player-toggle]"),
        seek,
        document.getElementById("beat-player-time"),
        document.querySelectorAll("[data-beat-player-mute]"),
        document.querySelectorAll("#beat-player-volume, #beat-player-fullscreen-volume"),
        waveform,
      );
      persistGlobalBeatPlayerState();
      emitGlobalBeatPlayerState();
    });
  });
  hrWaveSurfer.on("finish", () => {
    hrWaveSurfer.seekTo(0);
    if (player) player.dataset.state = "ended";
    syncGlobalBeatPlayerControls(
      player?.querySelectorAll("[data-beat-player-toggle]"),
      seek,
      document.getElementById("beat-player-time"),
      document.querySelectorAll("[data-beat-player-mute]"),
      document.querySelectorAll("#beat-player-volume, #beat-player-fullscreen-volume"),
      waveform,
    );
    persistGlobalBeatPlayerState();
    emitGlobalBeatPlayerState();
  });
  hrWaveSurfer.on("error", () => {
    const failedAt = hrWaveSurfer?.getCurrentTime?.() || 0;
    const fallbackDetail = hrCurrentBeatDetail || { src };
    destroyBeatWaveform();
    loadBeatFallbackAudio(fallbackDetail, { ...options, keepCurrentAudio: true, restoreTime: failedAt > 0 || options.restoreTime, currentTime: failedAt || options.currentTime || fallbackDetail.currentTime || 0 });
  });
}

function destroyBeatWaveform() {
  if (hrWaveSurfer) {
    try { hrWaveSurfer.destroy(); } catch {}
  }
  hrWaveSurfer = null;
  hrWaveSurferSrc = "";
  hrWaveSurferReady = false;
  setGlobalWaveformMode("fallback");
}

function loadBeatFallbackAudio(detail, options = {}) {
  const player = document.getElementById("hr-beat-player");
  const audio = document.getElementById("beat-audio");
  const waveform = document.getElementById("beat-player-waveform");
  const seek = document.getElementById("beat-player-seek");
  if (!audio) return;
  hrWaveSurferFailed = true;
  if (waveform) {
    waveform.hidden = false;
    setGlobalWaveformMode("fallback");
  }
  if (seek) seek.hidden = true;
  if (!options.keepCurrentAudio) {
    audio.src = detail.src;
    audio.load();
  }
  const restoreAt = Number(options.currentTime ?? (options.restoreTime ? detail.currentTime : 0));
  if (Number.isFinite(restoreAt) && restoreAt > 0) {
    audio.addEventListener("loadedmetadata", () => {
      audio.currentTime = Math.min(Math.max(0, restoreAt), Number.isFinite(audio.duration) ? audio.duration : restoreAt);
    }, { once: true });
  }
  if (player) player.dataset.state = "loading";
  if (options.autoplay) audio.play().catch(() => {});
}

function getBeatPlayerSrc() {
  return document.getElementById("beat-audio")?.src || hrWaveSurferSrc || "";
}

function getBeatPlayerCurrentTime() {
  return document.getElementById("beat-audio")?.currentTime || hrWaveSurfer?.getCurrentTime?.() || 0;
}

function getBeatPlayerDuration() {
  const audioDuration = document.getElementById("beat-audio")?.duration;
  return Number.isFinite(audioDuration) && audioDuration > 0 ? audioDuration : (hrWaveSurfer?.getDuration?.() || 0);
}

function isBeatPlayerPlaying() {
  const audio = document.getElementById("beat-audio");
  return Boolean(audio?.src && !audio.paused && !audio.ended);
}

function getBeatPlayerMuted() {
  return Boolean(document.getElementById("beat-audio")?.muted);
}

function setBeatPlayerMuted(muted) {
  if (hrWaveSurfer) hrWaveSurfer.setMuted(muted);
  const audio = document.getElementById("beat-audio");
  if (audio) audio.muted = muted;
}

function getBeatPlayerVolume() {
  return document.getElementById("beat-audio")?.volume ?? hrWaveSurfer?.getVolume?.() ?? 1;
}

function setBeatPlayerVolume(value) {
  if (hrWaveSurfer) hrWaveSurfer.setVolume(value);
  const audio = document.getElementById("beat-audio");
  if (audio) audio.volume = value;
}
function persistGlobalBeatPlayerState() {
  const title = document.getElementById("player-title");
  const meta = document.getElementById("player-detail");
  const art = document.getElementById("beat-player-art");
  const cover = art?.querySelector("img")?.src || "";
  const src = getBeatPlayerSrc();
  if (!src) return;
  try {
    sessionStorage.setItem(HR_BEAT_PLAYER_STORAGE_KEY, JSON.stringify({
      src,
      title: title?.textContent || "Beat Store",
      detail: meta?.textContent || "",
      cover,
      beatId: document.getElementById("hr-beat-player")?.dataset.beatId || hrCurrentBeatDetail?.beatId || "",
      genre: hrCurrentBeatDetail?.genre || "",
      bpm: hrCurrentBeatDetail?.bpm || "",
      key: hrCurrentBeatDetail?.key || "",
      currentTime: getBeatPlayerCurrentTime(),
      wasPlaying: isBeatPlayerPlaying(),
    }));
  } catch {}
}

window.addEventListener("pagehide", persistGlobalBeatPlayerState);
window.addEventListener("beforeunload", persistGlobalBeatPlayerState);
window.addEventListener("hr:beat-preview", (event) => {
  setGlobalBeatPlayer(event.detail, { autoplay: true });
});
window.addEventListener("hr:beat-preview-toggle", (event) => {
  const action = event.detail?.action;
  const audio = document.getElementById("beat-audio");
  if (audio?.src) {
    if (action === "pause") audio.pause();
    else audio.play().catch(() => {});
  }
  emitGlobalBeatPlayerState();
});

function attachGlobalDrawerSwipe(drawer) {
  if (!drawer) return;
  let startX = 0;
  let startY = 0;

  drawer.addEventListener("touchstart", (event) => {
    const touch = event.changedTouches[0];
    startX = touch.clientX;
    startY = touch.clientY;
  }, { passive: true });

  drawer.addEventListener("touchend", (event) => {
    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - startX;
    const deltaY = Math.abs(touch.clientY - startY);
    if (deltaX > 70 && deltaY < 80) toggleGlobalDrawer(false);
  }, { passive: true });
}

function renderGlobalNav() {
  const target = document.getElementById("hr-global-nav");
  if (!target) return;

  releaseGlobalOverlayState();
  document.body.classList.add("hr-has-global-nav");
  const module = document.body.dataset.hrContext || "home";
  const accent = module === "media" ? "media" : "brand";
  const activeModule = module;
  const navPath = window.location.pathname;
  const subnav = renderSubNav(module);
  const actionsClass = document.body.classList.contains("db-body")
    ? "hr-nav__actions db-topbar__actions"
    : "hr-nav__actions";

  target.innerHTML = `
    <header class="hr-nav" data-module="${module}" data-accent="${accent}">
      <div class="hr-nav__main">
        <a class="hr-nav__brand" href="/" aria-label="Hidden Room, inicio">
          <img src="/assets/img/white_logo.webp" alt="">
          <span>Hidden Room</span>
        </a>
        <nav class="hr-nav__links" aria-label="Navegación principal">
          ${ECOSYSTEM_LINKS.map(([key, href, label, adminOnly]) => `
            <a href="${href}"${adminOnly ? ' data-admin-nav-link hidden' : ""}${(key === activeModule && !(activeModule === "store" && navPath.startsWith("/store/beat_store/"))) || (key === "beat-store" && navPath.startsWith("/store/beat_store/")) ? ' aria-current="page"' : ""}>${label}</a>
          `).join("")}
        </nav>
        <div class="${actionsClass}">${renderNavActions(module)}</div>
        <button class="hr-nav__mobile-toggle" type="button" aria-label="Abrir menú"
          aria-controls="hr-global-drawer" aria-expanded="false">
          <span></span><span></span><span></span>
        </button>
      </div>
      ${subnav ? `<nav class="hr-nav__sub" aria-label="Navegación contextual">${subnav}</nav>` : ""}
    </header>
    ${renderGlobalDrawer(activeModule)}
    <aside class="hr-global-notifications" id="hr-global-notifications"
      aria-label="Notificaciones" hidden>
      <header>
        <div>
          <span>Cuenta</span>
          <strong>Notificaciones</strong>
        </div>
        <button type="button" data-hr-notifications-close aria-label="Cerrar notificaciones">x</button>
      </header>
      <ul data-hr-notifications-list>
        <li class="hr-global-notifications__empty">Cargando notificaciones...</li>
      </ul>
    </aside>
    ${document.getElementById("hr-beat-player") ? "" : renderGlobalBeatPlayer()}
  `;

  const globalBeatPlayer = target.querySelector("#hr-beat-player");
  const persistentBeatPlayer = globalBeatPlayer || document.getElementById("hr-beat-player");
  if (persistentBeatPlayer && persistentBeatPlayer.parentElement !== document.body) document.body.appendChild(persistentBeatPlayer);
  if (persistentBeatPlayer) document.body.classList.add("hr-has-beat-player");
  const fullscreenBeatPlayer = target.querySelector("#hr-beat-player-fullscreen") || document.getElementById("hr-beat-player-fullscreen");
  if (fullscreenBeatPlayer && fullscreenBeatPlayer.parentElement !== document.body) document.body.appendChild(fullscreenBeatPlayer);
  const globalDrawer = target.querySelector(".hr-global-drawer");
  const globalDrawerBackdrop = target.querySelector(".hr-global-drawer__backdrop");
  if (globalDrawerBackdrop) document.body.appendChild(globalDrawerBackdrop);
  if (globalDrawer) document.body.appendChild(globalDrawer);
  document.body.classList.toggle("hr-has-subnav", Boolean(subnav));

  target.querySelector(".hr-nav__mobile-toggle")?.addEventListener("click", () => {
    toggleGlobalDrawer();
  });
  document.querySelectorAll("[data-global-drawer-close]").forEach((control) => {
    control.addEventListener("click", () => toggleGlobalDrawer(false));
  });
  document.querySelector(".hr-global-drawer")?.addEventListener("click", (event) => {
    const actionButton = event.target.closest("[data-global-nav-action]");
    if (actionButton) {
      const action = actionButton.dataset.globalNavAction;
      const targetControl = document.querySelector(
        `#js-user-menu [data-action="${CSS.escape(action)}"], .db-sidebar__item[data-sidebar-action="${CSS.escape(action)}"]`,
      );
      if (targetControl) {
        event.preventDefault();
        targetControl.click();
      }
      toggleGlobalDrawer(false);
      return;
    }

    if (event.target.closest("a")) toggleGlobalDrawer(false);
  });
  attachGlobalDrawerSwipe(globalDrawer);
  if (!hrGlobalBeatPlayerHydrated) {
    hydrateGlobalBeatPlayer();
    hrGlobalBeatPlayerHydrated = true;
  }
}

function syncPortalSubNav() {
  if (!document.body.classList.contains("db-body")) return;
  const section = window.location.hash.slice(1);
  if (!section) return;

  const sidebarItem = document.querySelector(`.db-sidebar__item[data-section="${CSS.escape(section)}"]`);
  if (sidebarItem && !sidebarItem.closest("[hidden]")) sidebarItem.click();
}

window.addEventListener("hashchange", syncPortalSubNav);
window.addEventListener("DOMContentLoaded", syncPortalSubNav);
window.addEventListener("DOMContentLoaded", () => {
  hydrateGlobalInstagramUsernamePrompt();
  window.setTimeout(syncPortalSubNav, 500);
  window.setTimeout(syncPortalSubNav, 1400);
});

document.addEventListener("click", (event) => {
  const link = event.target.closest("[data-portal-section]");
  if (!link || !document.body.classList.contains("db-body")) return;

  const section = link.dataset.portalSection;
  const sidebarItem = document.querySelector(`.db-sidebar__item[data-section="${CSS.escape(section)}"]`);
  if (!sidebarItem || sidebarItem.closest("[hidden]")) return;

  event.preventDefault();
  window.history.replaceState(null, "", `#${section}`);
  document.querySelectorAll("[data-portal-section]").forEach((item) => {
    item.removeAttribute("aria-current");
  });
  link.setAttribute("aria-current", "page");
  sidebarItem.click();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") toggleGlobalNotifications(false);
  if (event.key === "Escape" && document.body.classList.contains("hr-global-menu-open")) {
    toggleGlobalDrawer(false);
  }
});

function initGlobalFooter() {
  const body = document.body;
  if (!body?.hasAttribute("data-hr-chrome")) return;

  const existingFooter = body.querySelector(":scope > footer") || body.querySelector("#hr-spa-content > footer");
  if (existingFooter) {
    existingFooter.classList.add("hr-site-footer");

    if (!existingFooter.querySelector("img")) {
      const logoLink = document.createElement("a");
      logoLink.href = "/";
      logoLink.setAttribute("aria-label", "Hidden Room");
      logoLink.innerHTML = '<img class="hr-site-footer__logo" src="/assets/img/white_logo.webp" alt="Hidden Room">';
      existingFooter.prepend(logoLink);
    }

    if (!existingFooter.querySelector(".site-status")) {
      const meta = document.createElement("div");
      meta.className = "hr-site-footer__meta";
      meta.innerHTML = `
        <span>Una marca de Grupo Mysauth</span>
        <span class="site-status"></span>
        <a href="/changelog.html" class="site-version"></a>
      `;
      existingFooter.insertBefore(meta, existingFooter.lastElementChild);
    }
  }

  if (body.dataset.hrFooter !== "false" && !existingFooter) {
    const footer = document.createElement("footer");
    footer.className = "hr-site-footer";
    footer.innerHTML = `
      <a href="/" aria-label="Hidden Room">
        <img class="hr-site-footer__logo" src="/assets/img/white_logo.webp" alt="Hidden Room">
      </a>
      <div class="hr-site-footer__meta">
        <span>Una marca de Grupo Mysauth</span>
        <span class="site-status"></span>
        <a href="/changelog.html" class="site-version"></a>
      </div>
      <div class="hr-site-footer__tagline">La Casa del Under</div>
    `;
    body.append(footer);
  }
}

renderGlobalNav();
attachGlobalNotificationListeners();
hydrateGlobalSession();
attachGlobalSessionSync();
initGlobalFooter();

document.querySelectorAll(".site-status").forEach(el => {
  el.textContent = SITE_STATUS;
});

document.querySelectorAll(".site-version").forEach(el => {
  el.textContent = SITE_VERSION;
});


/* =========================================================
   GLOBAL CUSTOM CURSOR
========================================================= */

const cursor = document.getElementById("cursor");
const ring = document.getElementById("cursorRing");

if (cursor && ring) {

  let mx = 0;
  let my = 0;
  let rx = 0;
  let ry = 0;

  document.addEventListener("mousemove", (e) => {
    mx = e.clientX;
    my = e.clientY;

    cursor.style.transform =
      `translate(${mx - 5}px, ${my - 5}px)`;
  });

  function animRing() {

    rx += (mx - rx) * 0.12;
    ry += (my - ry) * 0.12;

    ring.style.transform =
      `translate(${rx - 18}px, ${ry - 18}px)`;

    requestAnimationFrame(animRing);
  }

  animRing();

  function isCursorTarget(target) {
    return target?.closest?.('a, button, input, [role="button"], .event-row');
  }

  document.addEventListener('mouseenter', (event) => {
    if (isCursorTarget(event.target)) {
      ring.style.borderColor = 'rgba(219,1,0,0.8)';
      ring.style.scale = "1.5";
    }
  }, true);

  document.addEventListener('mouseleave', (event) => {
    if (isCursorTarget(event.target)) {
      ring.style.borderColor = 'rgba(219,1,0,0.5)';
      ring.style.scale = "1";
    }
  }, true);

}


/* =========================================================
   SCROLL REVEAL
========================================================= */

const revealElements = document.querySelectorAll('.reveal');

document.addEventListener('click', (event) => {
  const target = event.target.closest('[data-hr-funnel-event]');
  if (!target || typeof window.gtag !== 'function') return;
  window.gtag('event', target.dataset.hrFunnelEvent, { funnel: 'store' });
});

if (revealElements.length > 0) {

  const observer = new IntersectionObserver(entries => {

    entries.forEach(entry => {

      if (entry.isIntersecting) {

        setTimeout(() => {
          entry.target.classList.add('visible');
        }, 80);

        observer.unobserve(entry.target);
      }

    });

  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -60px 0px'
  });

  revealElements.forEach(el => observer.observe(el));
}


/* =========================================================
   EVENT ROW STAGGER
========================================================= */

document.querySelectorAll('.event-row').forEach((row, i) => {
  row.style.transitionDelay = `${i * 60}ms`;
});


/* =========================================================
   GALLERY SLIDER
========================================================= */

const track = document.getElementById('galleryTrack');

if (track) {

  let galleryIndex = 0;
  const total = track.children.length;

  window.slideGallery = function(dir) {

    galleryIndex =
      (galleryIndex + dir + total) % total;

    track.style.transform =
      `translateX(-${galleryIndex * 100}%)`;
  };

  document.querySelectorAll('[data-gallery-dir]').forEach((button) => {
    button.addEventListener('click', () => {
      window.slideGallery(Number(button.dataset.galleryDir || 0));
    });
  });

}
