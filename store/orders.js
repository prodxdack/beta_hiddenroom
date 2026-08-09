import { supabase, escapeHtml } from "./store.js";

const CLOUD_ORIGIN = "https://cloud.hiddenroom.mx";
const statusElement = document.getElementById("orders-status");
const listElement = document.getElementById("orders-list");

initializeOrders();

async function initializeOrders() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    sessionStorage.setItem("hr_return_after_login", "../store/orders.html");
    window.location.replace("../portal/");
    return;
  }

  const [{ data: orders, error: ordersError }, { data: downloads, error: downloadsError }] = await Promise.all([
    supabase
      .from("store_orders")
      .select("id, status, subtotal, total, currency, created_at, paid_at, store_order_items(id, product_id, product_name, quantity, unit_price, total, beat_id, license_id, producer_name, license_name, license_snapshot)")
      .order("created_at", { ascending: false }),
    supabase
      .from("store_downloads")
      .select("id, order_id, product_id, beat_id, license_id, license_name, file_url, available, download_count, created_at"),
  ]);

  if (ordersError || downloadsError) {
    statusElement.textContent = `No se pudieron cargar tus compras: ${(ordersError || downloadsError).message}`;
    return;
  }

  if (!orders?.length) {
    statusElement.textContent = "Todavía no tienes compras ligadas a esta cuenta.";
    listElement.innerHTML = '<a class="primary-button" href="index.html">Explorar tienda</a>';
    return;
  }

  statusElement.textContent = `${orders.length} compra${orders.length === 1 ? "" : "s"} encontrada${orders.length === 1 ? "" : "s"}.`;
  listElement.innerHTML = orders.map((order) => orderMarkup(
    order,
    (downloads ?? []).filter((download) => download.order_id === order.id),
  )).join("");
  listElement.addEventListener("click", handleDownloadClick);
}

function orderMarkup(order, downloads) {
  return `
    <article class="order-card">
      <header>
        <div>
          <span class="product-category">${escapeHtml(statusLabel(order.status))}</span>
          <h2>Pedido ${escapeHtml(order.id.slice(0, 8).toUpperCase())}</h2>
        </div>
        <div class="order-meta">
          <strong>${formatPrice(order.total, order.currency)}</strong>
          <span>${formatDate(order.created_at)}</span>
        </div>
      </header>
      <div class="order-items">
        ${(order.store_order_items ?? []).map((item) => `
          <div class="summary-line">
            ${item.license_name ? `<small class="summary-license">${escapeHtml(item.license_name)}${item.producer_name ? ` · ${escapeHtml(item.producer_name)}` : ""}</small>` : ""}
            <span>${escapeHtml(item.product_name)} × ${item.quantity}</span>
            <span>${formatPrice(item.total, order.currency)}</span>
          </div>`).join("")}
      </div>
      ${downloads.length ? `
        <div class="downloads-panel">
          <h3>Descargas</h3>
          ${downloads.map((download) => downloadMarkup(order, download)).join("")}
        </div>` : ""}
    </article>`;
}

function downloadMarkup(order, download) {
  if (!download.available) return "<span>Descarga no disponible</span>";
  const orderItem = (order.store_order_items ?? []).find((item) => item.product_id === download.product_id && (item.license_id === download.license_id || item.beat_id));
  const isBeatDownload = Boolean(download.beat_id || download.license_id || orderItem?.beat_id || orderItem?.license_id);
  if (isBeatDownload) {
    return `<button class="secondary-button" type="button" data-store-download="${escapeHtml(download.id)}">${download.license_name ? `Descargar ${escapeHtml(download.license_name)}` : "Descargar beat"}</button>`;
  }
  return download.file_url
    ? `<a class="secondary-button" href="${escapeHtml(download.file_url)}" target="_blank" rel="noopener">Descargar archivo</a>`
    : "<span>Descarga no disponible</span>";
}

async function handleDownloadClick(event) {
  const button = event.target.closest("[data-store-download]");
  if (!button) return;
  const originalLabel = button.textContent;
  button.disabled = true;
  button.textContent = "Preparando descarga...";
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error("Tu sesion expiro. Inicia sesion para descargar.");
    const response = await fetch(`${CLOUD_ORIGIN}/api/store/download-token`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ store_download_id: button.dataset.storeDownload }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.url) throw new Error(result.error || "No se pudo preparar la descarga.");
    window.location.assign(new URL(result.url, CLOUD_ORIGIN).href);
  } catch (error) {
    button.disabled = false;
    button.textContent = "Reintentar descarga";
    statusElement.textContent = error.message || "No se pudo preparar la descarga.";
  }
}

function statusLabel(status) {
  return {
    pending: "Pendiente",
    paid: "Pagado",
    cancelled: "Cancelado",
    refunded: "Reembolsado",
  }[status] || status;
}

function formatPrice(value, currency = "MXN") {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: currency || "MXN",
  }).format(Number(value));
}

function formatDate(value) {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
