(function initializeHiddenRoomLocalAnalytics() {
  const STORAGE_KEY = "hr_local_revenue_events_v1";
  const EVENT_NAMES = new Set([
    "page_view",
    "content_view",
    "cta_click",
    "store_entry",
    "add_to_cart",
    "begin_checkout",
    "payment_attempt",
    "payment_result",
    "studio_request_ready",
  ]);
  const MODULE_PATHS = [
    ["/store/beat_store/", "beat_store"],
    ["/store/", "store"],
    ["/studio/", "studio"],
    ["/academia/", "academia"],
    ["/tickets/", "events"],
    ["/media/", "media"],
  ];
  const localOnly = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname)
    || new URLSearchParams(window.location.search).has("hr_debug");

  function moduleForPath(pathname = window.location.pathname) {
    return MODULE_PATHS.find(([prefix]) => pathname.startsWith(prefix))?.[1] || "other";
  }

  function readEvents() {
    if (!localOnly) return [];
    try {
      const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function safeDetails(details = {}) {
    const allowed = ["module", "path", "item_type", "provider", "result", "content_slug"];
    return Object.fromEntries(allowed
      .filter((key) => details[key] !== undefined && details[key] !== null)
      .map((key) => [key, String(details[key]).slice(0, 100)]));
  }

  function track(name, details = {}) {
    if (!EVENT_NAMES.has(name) || !localOnly) return;
    const event = {
      name,
      at: new Date().toISOString(),
      ...safeDetails(details),
    };
    const events = [...readEvents(), event].slice(-250);
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(events)); } catch { /* storage may be disabled */ }
    window.dispatchEvent(new CustomEvent("hr:local-analytics", { detail: event }));
  }

  function clear() {
    if (localOnly) window.localStorage.removeItem(STORAGE_KEY);
  }

  window.HiddenRoomLocalAnalytics = { track, read: readEvents, clear, storageKey: STORAGE_KEY, localOnly };

  const originalGtag = typeof window.gtag === "function" ? window.gtag : null;
  if (originalGtag && !window.gtag.__hiddenRoomWrapped) {
    const wrappedGtag = (...args) => {
      originalGtag(...args);
      if (args[0] === "event" && typeof args[1] === "string") track(args[1], { ...args[2], module: args[2]?.module || moduleForPath() });
    };
    wrappedGtag.__hiddenRoomWrapped = true;
    window.gtag = wrappedGtag;
  }

  track("page_view", { module: moduleForPath(), path: window.location.pathname });
  const contentSlug = document.body.dataset.hrContentSlug;
  if (contentSlug) track("content_view", { module: "media", content_slug: contentSlug });
  document.addEventListener("click", (event) => {
    const link = event.target.closest?.("a[href]");
    if (!link) return;
    const url = new URL(link.href, window.location.href);
    if (url.origin !== window.location.origin) return;
    const module = moduleForPath(url.pathname);
    if (module === "other") return;
    track("cta_click", { module, path: url.pathname });
  });
})();
