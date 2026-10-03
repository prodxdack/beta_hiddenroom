const summary = document.getElementById("analytics-summary");
const recent = document.getElementById("analytics-recent");
const mode = document.getElementById("analytics-mode");

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
}

function render() {
  const analytics = window.HiddenRoomLocalAnalytics;
  const events = analytics?.read?.() || [];
  const counts = [
    ["Visitas", "page_view"],
    ["Interacciones", "cta_click"],
    ["Solicitudes Studio", "studio_request_ready"],
    ["Carritos", "add_to_cart"],
    ["Checkout", "begin_checkout"],
    ["Resultados de pago", "payment_result"],
  ];
  summary.innerHTML = counts.map(([label, name]) => `<article class="hr-card analytics-stat"><span>${label}</span><strong>${events.filter((event) => event.name === name).length}</strong></article>`).join("");
  recent.innerHTML = events.slice(-12).reverse().map((event) => `<li><strong>${escapeHTML(event.name)}</strong><span>${escapeHTML(event.module || "other")} · ${escapeHTML(event.path || event.content_slug || "—")}</span><time datetime="${escapeHTML(event.at)}">${escapeHTML(new Date(event.at).toLocaleString("es-MX"))}</time></li>`).join("") || "<li>No hay eventos locales todavía. Navega por Media, Studio o Store para generar señales.</li>";
  mode.textContent = analytics?.localOnly ? "LOCAL · sin red" : "Sólo disponible en entorno local";
}

window.addEventListener("hr:local-analytics", render);
document.getElementById("analytics-clear")?.addEventListener("click", () => {
  window.HiddenRoomLocalAnalytics?.clear();
  render();
});
render();
