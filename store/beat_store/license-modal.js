export function beatLicenseAssignmentIsSelectable(product, assignment) {
  if (!assignment?.is_enabled || assignment.beat_licenses?.is_active === false) return false;
  const hasDeliveryFields = ["beat_original_path", "beat_mp3_path", "beat_stems_path"]
    .some((field) => Object.prototype.hasOwnProperty.call(product || {}, field));
  return !hasDeliveryFields || beatLicenseMissingAssets(product, assignment).length === 0;
}

export function beatLicenseMissingAssets(product, assignment) {
  const format = String(assignment?.beat_licenses?.format || "").trim().toLowerCase();
  const requirements = [
    format.includes("wav") ? ["beat_original_path", ".wav", "WAV"] : null,
    format.includes("mp3") ? ["beat_mp3_path", ".mp3", "MP3"] : null,
    format.includes("stem") ? ["beat_stems_path", ".zip", "STEMS"] : null,
  ].filter(Boolean);
  return requirements
    .filter(([field, extension]) => !String(product?.[field] || "").trim().toLowerCase().endsWith(extension))
    .map(([, , label]) => label);
}

export function beatLicenseModalMarkup({
  product,
  assignments = [],
  targetId = product?.id,
  includeStemsPlaceholder = true,
  emptyMessage = "Este beat todavía no tiene licencias configuradas.",
}) {
  if (!product) return "<p class=\"beat-license-empty\">" + escapeHtml(emptyMessage) + "</p>";

  const licenses = assignments
    .filter((assignment) => assignment?.beat_licenses?.is_active !== false)
    .filter((assignment) => assignment?.beat_id === product.id)
    .map((assignment) => {
      const license = assignment.beat_licenses || {};
      const selectable = beatLicenseAssignmentIsSelectable(product, assignment);
      const missingAssets = beatLicenseMissingAssets(product, assignment);
      const unavailableReason = missingAssets.length
        ? "No disponible: falta " + missingAssets.join(" + ")
        : "No disponible: licencia bloqueada";
      return {
        id: assignment.license_id,
        name: license.name || "Licencia",
        description: license.description || "Licencia disponible para este beat.",
        price: Number(assignment.price),
        streams: streamLimitLabel(license),
        format: license.format || "",
        terms: license.terms || "",
        selectable,
        unavailableReason,
      };
    });

  const hasStemsAssignment = licenses.some((license) => String(license.format).toLowerCase().includes("stem"));
  const entries = [
    ...licenses.map((license) => licenseMarkup(license, product, targetId)),
    ...(includeStemsPlaceholder && !hasStemsAssignment ? [stemsComingSoonMarkup()] : []),
  ];
  if (!entries.length) return "<p class=\"beat-license-empty\">" + escapeHtml(emptyMessage) + "</p>";
  return "<div class=\"beat-license-list\">" + entries.join("") + "</div>";
}

function licenseMarkup(license, product, targetId) {
  const unavailableMarkup = license.selectable
    ? ""
    : '<p class="beat-license-option__status" role="status">AÚN NO DISPONIBLE EN ESTE BEAT</p>' +
      '<p class="beat-license-option__reason">' + escapeHtml(license.unavailableReason) + "</p>";
  const actionsMarkup = license.selectable
    ? "<button class=\"primary-button\" type=\"button\" data-buy-license=\"" + escapeHtml(targetId) + "\" data-license-id=\"" + escapeHtml(license.id) + "\">Comprar ahora</button>" +
      "<button class=\"secondary-button\" type=\"button\" data-add-license=\"" + escapeHtml(targetId) + "\" data-license-id=\"" + escapeHtml(license.id) + "\">Añadir al carrito</button>"
    : '<a class="secondary-button beat-license-option__request" href="' + escapeHtml(whatsappHref(product, license)) + '" target="_blank" rel="noopener noreferrer">Solicitar beat vía WhatsApp</a>';
  return [
    "<article class=\"beat-license-option" + (license.selectable ? "" : " beat-license-option--disabled") + "\">",
    "  <header><div><h5>" + escapeHtml(license.name) + "</h5><p>" + escapeHtml(license.description) + "</p></div><strong>" + escapeHtml(formatPrice(license.price, product.currency)) + "</strong></header>",
    "  <dl><div><dt>Límite</dt><dd>" + escapeHtml(license.streams) + "</dd></div>" + (license.format ? "<div><dt>Formato</dt><dd>" + escapeHtml(license.format) + "</dd></div>" : "") + "</dl>",
    "  " + unavailableMarkup,
    license.terms ? "  <p class=\"beat-license-terms\">" + escapeHtml(license.terms) + "</p>" : "",
    "  <div class=\"beat-license-actions\">" + actionsMarkup + "</div>",
    "</article>",
  ].join("");
}

function stemsComingSoonMarkup() {
  return [
    '<article class="beat-license-option beat-license-option--disabled" aria-disabled="true">',
    "  <header><div><h5>Stems</h5><p>Esta licencia estará disponible próximamente.</p></div><strong>PRÓXIMAMENTE</strong></header>",
    '  <dl><div><dt>Estado</dt><dd>Bloqueada</dd></div><div><dt>Formato</dt><dd>Stems</dd></div></dl>',
    '  <div class="beat-license-actions"><button class="secondary-button" type="button" disabled aria-disabled="true">Próximamente</button></div>',
    "</article>",
  ].join("");
}

function whatsappHref(product, license) {
  const message = "Hola, quiero solicitar el beat " + String(product?.name || "del catálogo") + " y la licencia " + String(license?.name || "seleccionada") + ".";
  return "https://wa.me/525542881737?text=" + encodeURIComponent(message);
}

function streamLimitLabel(license) {
  if (!license) return "Por confirmar";
  if (license.unlimited_streams) return "Ilimitados";
  const limit = Number(license.stream_limit);
  return Number.isFinite(limit) ? new Intl.NumberFormat("es-MX").format(limit) + " streams" : "Por confirmar";
}

function formatPrice(value, currency = "MXN") {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: currency || "MXN",
  }).format(Number(value));
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));
}