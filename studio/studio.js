const WHATSAPP_NUMBER = '525542881737';

const STUDIO_SERVICES = Object.freeze([
  { id: 'recording', name: 'Grabación 1 hr', duration: '60 min', price: 650, detail: 'Una sesión enfocada para avanzar una idea.' },
  { id: 'custom-beat', name: 'Grabación + beat personalizado', duration: '90 min', price: 1700, detail: 'Grabación y beat personalizado en una sesión extendida.' },
  { id: 'membership', name: 'Membresía', duration: 'Semanal', price: 500, suffix: ' / semana', detail: 'Una opción recurrente para mantener el ritmo.' },
  { id: 'premium', name: 'Paquete premium', duration: 'Consulta de alcance', price: 3700, detail: 'Una ruta amplia para producción y seguimiento.' },
  { id: 'ep', name: 'EP', duration: 'Proyecto', price: 7800, detail: 'Un proyecto completo para darle forma a varias canciones.' },
]);

const STUDIO_LOCATIONS = Object.freeze(['Ixtapaluca', 'Iztapalapa', 'Venustiano Carranza']);
const form = document.querySelector('#studio-request-form');
const serviceSelect = document.querySelector('#studio-service');
const locationSelect = document.querySelector('#studio-location');
const dateInput = document.querySelector('#studio-date');
const price = document.querySelector('#studio-price');
const result = document.querySelector('#studio-request-result');
const servicesGrid = document.querySelector('#studio-services-grid');

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
}

function money(value) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(value);
}

function formatDate(value) {
  if (!value) return 'por confirmar';
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'long' }).format(new Date(`${value}T12:00:00`));
}

function getSelectedService() {
  return STUDIO_SERVICES.find((service) => service.id === serviceSelect?.value) ?? null;
}

function renderServiceOptions() {
  if (!serviceSelect) return;
  serviceSelect.innerHTML = [
    '<option value="">Selecciona un servicio</option>',
    ...STUDIO_SERVICES.map((service) => `<option value="${escapeHTML(service.id)}">${escapeHTML(service.name)} — ${escapeHTML(money(service.price))}${escapeHTML(service.suffix ?? '')}</option>`),
  ].join('');
}

function renderLocationOptions() {
  if (!locationSelect) return;
  locationSelect.innerHTML = [
    '<option value="">Selecciona una sede</option>',
    ...STUDIO_LOCATIONS.map((location) => `<option value="${escapeHTML(location)}">${escapeHTML(location)}</option>`),
  ].join('');
}

function renderServices() {
  if (!servicesGrid) return;
  servicesGrid.innerHTML = STUDIO_SERVICES.map((service, index) => `
    <article class="studio-service-card hr-card">
      <div class="studio-service-card__index">0${index + 1}</div>
      <div class="studio-service-card__body">
        <p class="hr-eyebrow">${escapeHTML(service.duration)}</p>
        <h3>${escapeHTML(service.name)}</h3>
        <p>${escapeHTML(service.detail)}</p>
      </div>
      <strong class="studio-service-card__price">${escapeHTML(money(service.price))}<small>${escapeHTML(service.suffix ?? ' MXN')}</small></strong>
      <button class="hr-btn hr-btn-outline" type="button" data-studio-service="${escapeHTML(service.id)}">Elegir servicio</button>
    </article>
  `).join('');
}

function updatePrice() {
  const service = getSelectedService();
  if (!price) return;
  price.textContent = service ? `${money(service.price)}${service.suffix ?? ' MXN'} · ${service.duration}` : 'Selecciona un servicio';
}

function setMinDate() {
  if (!dateInput) return;
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  dateInput.min = `${today.getFullYear()}-${month}-${day}`;
}

function scrollToRequest() {
  document.querySelector('#solicitud')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function handleServiceChoice(event) {
  const button = event.target.closest('[data-studio-service]');
  if (!button) return;
  if (serviceSelect) serviceSelect.value = button.dataset.studioService;
  updatePrice();
  scrollToRequest();
}

function buildWhatsAppURL(values, service) {
  const lines = [
    'Hola Hidden Room, quiero solicitar una sesión de Studio.',
    `Servicio: ${service.name}`,
    `Precio publicado: ${money(service.price)}${service.suffix ?? ' MXN'}`,
    `Sede preferida: ${values.location}`,
    `Fecha preferida: ${formatDate(values.date)}`,
    values.name ? `Proyecto: ${values.name}` : '',
    values.notes ? `Nota: ${values.notes}` : '',
    '',
    '¿Podemos confirmar disponibilidad y siguientes pasos?',
  ].filter(Boolean);
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(lines.join('\n'))}`;
}

function showResult(values, service) {
  if (!result) return;
  const requestId = `HR-ST-${Date.now().toString(36).toUpperCase()}`;
  const url = buildWhatsAppURL(values, service);
  result.hidden = false;
  result.innerHTML = `
    <strong>Solicitud preparada · ${escapeHTML(requestId)}</strong>
    <p>${escapeHTML(service.name)} · ${escapeHTML(values.location)} · ${escapeHTML(formatDate(values.date))}</p>
    <a class="hr-btn hr-btn-primary" href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer">Abrir mensaje en WhatsApp</a>
    <button class="hr-btn hr-btn-outline" type="button" data-studio-reset>Editar solicitud</button>
  `;
}

function handleSubmit(event) {
  event.preventDefault();
  const service = getSelectedService();
  const values = Object.fromEntries(new FormData(form).entries());
  if (!service || !values.location || !values.date || (dateInput?.validity && !dateInput.validity.valid)) {
    result.hidden = false;
    result.innerHTML = '<strong>Falta un dato</strong><p>Elige servicio, sede y una fecha válida para preparar la solicitud.</p>';
    return;
  }
  showResult(values, service);
  window.HiddenRoomLocalAnalytics?.track("studio_request_ready", { module: "studio" });
}

function handleResultClick(event) {
  if (!event.target.closest('[data-studio-reset]')) return;
  result.hidden = true;
  result.innerHTML = '';
  serviceSelect?.focus();
}

renderServiceOptions();
renderLocationOptions();
renderServices();
setMinDate();
updatePrice();
serviceSelect?.addEventListener('change', updatePrice);
servicesGrid?.addEventListener('click', handleServiceChoice);
form?.addEventListener('submit', handleSubmit);
result?.addEventListener('click', handleResultClick);
