const WHATSAPP_NUMBER = "525542881737";
const form = document.querySelector("#business-quote-form");
const result = document.querySelector("#business-quote-result");

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;",
  }[char]));
}

function buildWhatsAppURL(values, projectLabel) {
  const lines = [
    "Hola Hidden Room, quiero solicitar una cotización empresarial.",
    `Proyecto: ${projectLabel}`,
    `Nombre: ${values.name}`,
    `Empresa o marca: ${values.company}`,
    `Correo: ${values.email}`,
    values.phone ? `Teléfono o WhatsApp: ${values.phone}` : "",
    `Descripción: ${values.description}`,
    values.date ? `Fecha deseada: ${values.date}` : "",
    values.budget ? `Presupuesto aproximado: ${values.budget}` : "",
    "",
    "¿Podemos revisar el alcance y siguientes pasos?",
  ].filter(Boolean);
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(lines.join("\n"))}`;
}

function showResult(values, projectLabel) {
  const requestId = `HR-B2B-${Date.now().toString(36).toUpperCase()}`;
  const url = buildWhatsAppURL(values, projectLabel);
  result.hidden = false;
  result.innerHTML = `
    <strong>Solicitud preparada · ${escapeHTML(requestId)}</strong>
    <p>El formulario no guarda ni envía datos automáticamente. Revisa el mensaje antes de abrir WhatsApp.</p>
    <a class="hr-btn hr-btn-primary" href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer">Abrir mensaje en WhatsApp</a>
    <button class="hr-btn hr-btn-outline" type="button" data-business-reset>Editar solicitud</button>
  `;
}

function showError(message) {
  result.hidden = false;
  result.innerHTML = `<strong>Revisa la solicitud</strong><p>${escapeHTML(message)}</p>`;
}

function handleSubmit(event) {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(form).entries());
  const project = form.querySelector("[name=project]");
  const projectLabel = project?.selectedOptions?.[0]?.textContent?.trim() || "Proyecto musical";
  if (values.website) return;
  if (!values.name || !values.company || !values.email || !values.project || !values.description) {
    showError("Completa nombre, empresa o marca, correo, tipo de proyecto y descripción.");
    return;
  }
  if (form.querySelector("[name=email]")?.validity?.valid === false) {
    showError("Escribe un correo electrónico válido.");
    return;
  }
  showResult(values, projectLabel);
  window.HiddenRoomLocalAnalytics?.track("business_quote_ready", { module: "empresas", project: values.project });
}

form?.addEventListener("submit", handleSubmit);
result?.addEventListener("click", (event) => {
  if (!event.target.closest("[data-business-reset]")) return;
  result.hidden = true;
  result.innerHTML = "";
  form.querySelector("[name=name]")?.focus();
});
