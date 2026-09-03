const supabase = await window.HiddenRoomSupabase.getClient();
const statusElement = document.getElementById('producer-ready-status');
const introElement = document.getElementById('producer-ready-intro');
const listElement = document.getElementById('producer-ready-list');
const newLink = document.getElementById('new-beat-link');
const state = { session: null, profile: null, products: [] };

init().catch((error) => showError(error.message || 'No se pudo cargar Mis Beats.'));

async function init() {
  const { data } = await supabase.auth.getSession();
  state.session = data.session;
  if (!state.session) { sessionStorage.setItem('hr_return_after_login', '../store/beat_store/my-beats.html'); window.location.replace('../../portal/'); return; }
  const { data: profile, error: profileError } = await supabase.from('producer_profiles').select('id, slug, display_name, approval_status, is_active').eq('user_id', state.session.user.id).maybeSingle();
  if (profileError) throw new Error(profileError.message);
  state.profile = profile;
  if (!profile) { introElement.textContent = 'Tu cuenta todavía no tiene perfil de productor.'; renderEmpty('Solicita a un administrador la habilitación de tu perfil.'); return; }
  if (profile.approval_status !== 'approved' || !profile.is_active) { introElement.textContent = `Perfil ${labelStatus(profile.approval_status)}.`; renderEmpty('El flujo de subida está disponible sólo para productores aprobados.'); return; }
  newLink.hidden = false;
  introElement.textContent = `${profile.display_name} · productor aprobado`;
  await loadProducts();
  listElement.addEventListener('click', handleAction);
}

async function loadProducts() {
  const { data, error } = await supabase.from('store_products').select('id, slug, name, price, currency, publication_status, review_comment, updated_at, beat_preview_status, beat_cover_path').eq('category', 'beats').eq('producer_user_id', state.session.user.id).order('updated_at', { ascending: false });
  if (error) throw new Error(error.message);
  state.products = data || [];
  statusElement.textContent = `${state.products.length} beat${state.products.length === 1 ? '' : 's'} en tu espacio.`;
  if (!state.products.length) return renderEmpty('Todavía no tienes beats. Crea un borrador para comenzar.');
  listElement.innerHTML = state.products.map(productCard).join('');
}

function productCard(product) {
  const canSubmit = product.publication_status === 'draft';
  return `<article class="producer-ready-card"><div class="producer-ready-card__meta"><span class="producer-ready-badge">${escapeHtml(labelStatus(product.publication_status))}</span><span>${escapeHtml(formatDate(product.updated_at))}</span></div><h2>${escapeHtml(product.name)}</h2><p>${escapeHtml(product.review_comment || 'Sin comentarios de revisión.')}</p><div class="producer-ready-card__actions"><a class="secondary-button" href="new-beat.html?id=${encodeURIComponent(product.id)}">Abrir borrador</a>${canSubmit ? `<button class="primary-button" type="button" data-submit="${escapeHtml(product.id)}">Enviar a revisión</button>` : ''}</div></article>`;
}

async function handleAction(event) {
  const button = event.target.closest('[data-submit]');
  if (!button) return;
  button.disabled = true;
  try { const { error } = await supabase.rpc('submit_beat_for_review', { p_beat_id: button.dataset.submit }); if (error) throw new Error(error.message); await loadProducts(); statusElement.textContent = 'Beat enviado a revisión.'; }
  catch (error) { showError(error.message || 'No se pudo enviar el beat.'); button.disabled = false; }
}

function renderEmpty(message) { listElement.innerHTML = `<div class="producer-ready-panel"><h2>Sin beats todavía</h2><p>${escapeHtml(message)}</p></div>`; }
function showError(message) { statusElement.textContent = message; statusElement.classList.add('is-error'); }
function labelStatus(status) { return ({ pending: 'pendiente', approved: 'aprobado', rejected: 'rechazado', suspended: 'suspendido', draft: 'borrador', pending_review: 'en revisión', published: 'publicado', inactive: 'inactivo' })[status] || status || 'sin estado'; }
function formatDate(value) { return value ? new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' }).format(new Date(value)) : 'sin fecha'; }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char])); }
