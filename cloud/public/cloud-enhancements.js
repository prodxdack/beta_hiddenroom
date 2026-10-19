import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabase = createClient('https://rpcunbkstadgngqrjafp.supabase.co', 'sb_publishable_7v_FIgTjWjJgtT1YHIAYSw_bRBmQjZO');
const custom = { mode: 'files', data: null, favorites: new Set(), favoriteRows: [], path: '/', selectionMode: false, selected: new Set(), selectionItems: new Map(), pressTimer: null, suppressNextClick: false };
const $ = (id) => document.getElementById(id);
const favoriteStyles = document.createElement('link');
favoriteStyles.rel = 'stylesheet';
favoriteStyles.href = '/cloud-favorites.css?v=20261014-cloud-actions-v1';
document.head.appendChild(favoriteStyles);
function esc(value) {
  const node = document.createElement('span');
  node.textContent = String(value);
  return node.innerHTML;
}
function norm(value) {
  if (!value || value === '/') return '/';
  let result = String(value).replace(/\\/g, '/').replace(/\/+/g, '/');
  if (!result.startsWith('/')) result = '/' + result;
  return result !== '/' && result.endsWith('/') ? result.slice(0, -1) : result;
}
function currentPath() {
  const buttons = Array.from(document.querySelectorAll('#breadcrumb button[data-path]'));
  return norm(buttons.at(-1)?.dataset.path || custom.path || '/');
}
async function token(force = false) {
  if (window.HRCloudLocalSession?.base) return window.HRCloudLocalSession.token(force);
  const result = await supabase.auth.getSession();
  if (!result.data.session?.access_token) throw Error('Sesion requerida.');
  return result.data.session.access_token;
}
async function api(url, options) {
  const send = async (value) => fetch(url, { ...(options || {}), cache: 'no-store', headers: { Authorization: 'Bearer ' + value, ...((options || {}).headers || {}) } });
  let response = await send(await token());
  if (response.status === 401 && window.HRCloudLocalSession?.base) {
    response = await send(await token(true));
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw Error(body?.error || 'Error ' + response.status);
  }
  return response;
}
async function json(url, options) {
  return (await api(url, options)).json();
}
function favoriteKey(path, name) {
  return norm(path) + String.fromCharCode(0) + name;
}
function loadFavoriteRows() {
  return json('/api/favorites').then((data) => {
    custom.favoriteRows = data.files || [];
    custom.favorites = new Set(custom.favoriteRows.map((row) => favoriteKey(row.path, row.name)));
    return data;
  });
}
function setMenu(open) {
  const menu = document.getElementById('cloud-menu');
  const button = document.getElementById('menu-button');
  menu.hidden = !open;
  button.setAttribute('aria-expanded', String(open));
}
function selectionKey(path, name) {
  return norm(path) + String.fromCharCode(0) + String(name || '');
}
function selectionInfo(node) {
  if (!node) return null;
  const source = node.matches('.file-card') ? node : node.querySelector('[data-name]');
  const name = node.dataset.name || source?.dataset.name;
  if (!name) return null;
  const path = norm(node.dataset.path || source?.dataset.path || currentPath());
  const type = node.dataset.type || source?.dataset.type || (node.dataset.action === 'open' ? 'folder' : 'file');
  return { name, path, type, key: selectionKey(path, name) };
}
function decorateSelection() {
  document.querySelectorAll('.file-card[data-name], .list-row').forEach((node) => {
    const info = selectionInfo(node);
    if (!info) return;
    node.dataset.selectable = 'true';
    node.classList.toggle('is-selected', custom.selected.has(info.key));
    node.setAttribute('aria-selected', String(custom.selected.has(info.key)));
    if (node.matches('.file-card') && !node.querySelector('.selection-mark')) {
      node.insertAdjacentHTML('afterbegin', '<span class="selection-mark" aria-hidden="true"><i class="ph ph-check"></i></span>');
    }
  });
}
function ensureSelectionControls() {
  const toolbar = document.querySelector('.toolbar');
  if (!toolbar || document.getElementById('selection-mode-button')) return;
  const button = document.createElement('button');
  button.id = 'selection-mode-button';
  button.className = 'icon-button selection-mode-button';
  button.type = 'button';
  button.setAttribute('aria-pressed', 'false');
  button.title = 'Seleccionar varios';
  button.innerHTML = '<i class="ph ph-check-square-offset" aria-hidden="true"></i><span class="selection-label">Seleccionar varios</span><b class="selection-count" hidden>0</b>';
  toolbar.insertBefore(button, toolbar.querySelector('.views'));
}
function ensureActionControls() {
  const search = document.querySelector('.search');
  if (!search || search.querySelector('.search-actions-trigger')) return;
  const button = document.createElement('button');
  button.className = 'search-actions-trigger';
  button.type = 'button';
  button.setAttribute('aria-label', 'Opciones del archivo');
  button.setAttribute('aria-haspopup', 'menu');
  button.innerHTML = '<i class="ph ph-dots-three-vertical" aria-hidden="true"></i>';
  search.appendChild(button);
}
function updateSelectionControls() {
  ensureSelectionControls();
  const button = document.getElementById('selection-mode-button');
  if (!button) return;
  const count = button.querySelector('.selection-count');
  const label = button.querySelector('.selection-label');
  button.classList.toggle('active', custom.selectionMode);
  button.setAttribute('aria-pressed', String(custom.selectionMode));
  button.title = custom.selectionMode ? 'Cancelar seleccion multiple' : 'Seleccionar varios';
  if (label) label.textContent = custom.selectionMode ? 'Cancelar selecci�n' : 'Seleccionar varios';
  if (count) {
    count.hidden = !custom.selected.size;
    count.textContent = String(custom.selected.size);
  }
  document.getElementById('explorer')?.classList.toggle('selection-active', custom.selectionMode);
}
function setSelectionMode(active) {
  custom.selectionMode = Boolean(active);
  if (!custom.selectionMode) {
    custom.selected.clear();
    custom.selectionItems.clear();
  }
  if (!custom.selectionMode) closeActionMenu();
  updateSelectionControls();
  decorateSelection();
}
function toggleSelected(node) {
  const info = selectionInfo(node);
  if (!info) return;
  custom.selectionMode = true;
  if (custom.selected.has(info.key)) custom.selected.delete(info.key);
  else custom.selected.add(info.key);
  if (custom.selected.has(info.key)) custom.selectionItems.set(info.key, info);
  else custom.selectionItems.delete(info.key);
  updateSelectionControls();
  decorateSelection();
}
const actionMenuState = { element: null, anchor: null, item: null };
const actionMenuItems = [
  { key: 'move', label: 'Mover', icon: 'ph-folder-notch-open' },
  { key: 'copy', label: 'Copiar', icon: 'ph-copy' },
  { key: 'delete', label: 'Eliminar', icon: 'ph-trash', danger: true },
  { key: 'favorite', label: 'Favoritos', icon: 'ph-heart' },
];
function ensureActionMenu() {
  if (actionMenuState.element) return actionMenuState.element;
  const menu = document.createElement('div');
  menu.className = 'cloud-action-menu';
  menu.setAttribute('role', 'menu');
  menu.hidden = true;
  document.body.appendChild(menu);
  actionMenuState.element = menu;
  return menu;
}
function actionItemsForMenu() {
  return actionMenuState.item ? [actionMenuState.item] : [...custom.selectionItems.values()];
}
function renderActionMenu() {
  const menu = ensureActionMenu();
  const items = actionItemsForMenu();
  const hasItems = items.length > 0;
  const onlyFolders = hasItems && items.every((item) => item.type === 'folder');
  const favoriteLabel = items.length === 1 && custom.favorites.has(favoriteKey(items[0].path, items[0].name)) ? 'Quitar de favoritos' : 'A�adir a favoritos';
  menu.innerHTML = actionMenuItems.map((action) => {
    const disabled = !hasItems || (action.key === 'favorite' && onlyFolders);
    const label = action.key === 'favorite' ? favoriteLabel : action.label;
    return '<button class="cloud-action-item' + (action.danger ? ' danger' : '') + '" data-action-menu="' + action.key + '" type="button" role="menuitem"' + (disabled ? ' disabled' : '') + '><i class="ph ' + action.icon + '" aria-hidden="true"></i><span>' + label + '</span></button>';
  }).join('');
  return menu;
}
function positionActionMenu(anchor) {
  const menu = actionMenuState.element;
  if (!menu || !anchor) return;
  const rect = anchor.getBoundingClientRect();
  const gap = 8;
  const width = menu.offsetWidth;
  const height = menu.offsetHeight;
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
  const below = rect.bottom + gap;
  const top = below + height <= window.innerHeight - 8 ? below : Math.max(8, rect.top - height - gap);
  menu.style.left = left + 'px';
  menu.style.top = top + 'px';
}
function openActionMenu(item, anchor) {
  actionMenuState.item = item || null;
  actionMenuState.anchor = anchor || document.querySelector('.search-actions-trigger');
  const menu = renderActionMenu();
  menu.hidden = false;
  menu.classList.toggle('is-contextual', Boolean(item));
  actionMenuState.anchor?.setAttribute('aria-expanded', 'true');
  positionActionMenu(actionMenuState.anchor);
}
function closeActionMenu() {
  if (actionMenuState.element) actionMenuState.element.hidden = true;
  actionMenuState.anchor?.setAttribute('aria-expanded', 'false');
  actionMenuState.anchor = null;
  actionMenuState.item = null;
}
function selectedActionItems() {
  return actionItemsForMenu().filter((item) => item?.name);
}
async function refreshAfterAction() {
  custom.selected.clear();
  custom.selectionItems.clear();
  setSelectionMode(false);
  if (custom.mode === 'files') document.getElementById('refresh-button')?.click();
  else await openCustom(custom.mode);
}
async function runActionMenu(kind) {
  const items = selectedActionItems();
  closeActionMenu();
  if (!items.length) {
    setStatus('Selecciona al menos un elemento.', true);
    return;
  }
  if (kind === 'favorite') {
    const files = items.filter((item) => item.type !== 'folder');
    if (!files.length) return setStatus('Solo los archivos pueden ser favoritos.', true);
    const shouldFavorite = !files.every((item) => custom.favorites.has(favoriteKey(item.path, item.name)));
    for (const item of files) {
      await json('/api/favorites', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: item.path, name: item.name, type: 'file', favorite: shouldFavorite }) });
    }
    await loadFavoriteRows();
    setStatus(shouldFavorite ? 'A�adido a favoritos.' : 'Quitado de favoritos.');
    decorateFiles();
    return;
  }
  if (kind === 'delete') {
    if (!confirm('�Mover ' + items.length + ' elemento' + (items.length === 1 ? '' : 's') + ' a la papelera?')) return;
    for (const item of items) await api('/api/item?path=' + encodeURIComponent(item.path) + '&type=' + encodeURIComponent(item.type) + '&name=' + encodeURIComponent(item.name), { method: 'DELETE' });
    await refreshAfterAction();
    setStatus('Elemento' + (items.length === 1 ? '' : 's') + ' movido' + (items.length === 1 ? '' : 's') + ' a la papelera.');
    return;
  }
  const destinationPath = prompt(kind === 'move' ? 'Ruta destino para mover:' : 'Ruta destino para copiar:', items[0].path || '/');
  if (destinationPath === null) return;
  for (const item of items) {
    await json('/api/' + kind, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: item.path, name: item.name, type: item.type, destinationPath: norm(destinationPath) }) });
  }
  await refreshAfterAction();
  setStatus(kind === 'move' ? 'Elemento movido.' : 'Elemento copiado.');
}
function iconFor(name) {
  const lower = String(name || '').toLowerCase();
  if (/\.(png|jpe?g|gif|webp|svg|bmp|heic|avif)$/.test(lower)) return '<i class="ph ph-image"></i>';
  if (/\.(mp3|wav|flac|m4a|aac|ogg|mp4|mov|webm|mkv|avi)$/.test(lower)) return '<i class="ph ph-music-note"></i>';
  if (/\.(pdf|docx?|xlsx?|pptx?|txt|md|csv|json)$/.test(lower)) return '<i class="ph ph-file-text"></i>';
  return '<i class="ph ph-file"></i>';
}
function sizeText(value) {
  const size = Number(value || 0);
  if (size < 1024) return size + ' B';
  if (size < 1048576) return (size / 1024).toFixed(1) + ' KB';
  if (size < 1073741824) return (size / 1048576).toFixed(1) + ' MB';
  return (size / 1073741824).toFixed(1) + ' GB';
}
function dateText(value) {
  const date = new Date(value || 0);
  return value && !Number.isNaN(date.getTime()) ? new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(date) : '---';
}
function setStatus(text, error) {
  const status = document.getElementById('status-message');
  status.textContent = text || '';
  status.classList.toggle('error', Boolean(error));
}
function customCard(row, mode) {
  const trash = mode === 'trash';
  const actions = trash
    ? '<button class="mini" data-cloud-action="restore" data-id="' + esc(row.id) + '" type="button" title="Restaurar"><i class="ph ph-arrow-u-up-left"></i></button><button class="mini danger" data-cloud-action="purge" data-id="' + esc(row.id) + '" data-name="' + esc(row.name) + '" type="button" title="Eliminar para siempre"><i class="ph ph-trash"></i></button>'
    : '<button class="mini favorite-button is-favorite" data-cloud-action="favorite" data-path="' + esc(row.path) + '" data-name="' + esc(row.name) + '" type="button" title="Quitar de favoritos"><i class="ph ph-heart-fill"></i></button><button class="mini" data-cloud-action="download" data-path="' + esc(row.path) + '" data-name="' + esc(row.name) + '" type="button" title="Descargar"><i class="ph ph-download-simple"></i></button>';
  return '<article class="file-card custom-file-card" data-action="noop" data-name="' + esc(row.name) + '" data-path="' + esc(row.path || '/') + '" data-type="' + esc(row.type || 'file') + '"><div class="file-card-top"><span class="file-icon">' + iconFor(row.name) + '</span><div class="card-menu">' + actions + '</div></div><p class="file-name">' + esc(row.name) + '</p><div class="file-card-foot"><span>' + sizeText(row.size) + '</span><span>' + dateText(trash ? row.deletedAt : row.modified) + '</span></div></article>';
}
function renderCustom(data, mode) {
  custom.mode = mode;
  custom.data = data;
  const rows = (data.folders || []).concat(data.files || []);
  const search = document.getElementById('search-input');
  const query = search.value.trim().toLocaleLowerCase('es-MX');
  const filtered = rows.filter((row) => !query || String(row.name || '').toLocaleLowerCase('es-MX').includes(query));
  document.getElementById('grid').innerHTML = filtered.map((row) => customCard(row, mode)).join('');
  document.getElementById('grid').hidden = false;
  document.getElementById('list').hidden = true;
  document.getElementById('loading').hidden = true;
  document.getElementById('empty').hidden = Boolean(filtered.length);
  document.getElementById('empty-title').textContent = mode === 'favorites' ? 'Aun no tienes favoritos' : 'La papelera esta vacia';
  document.getElementById('empty-copy').textContent = mode === 'favorites' ? 'Pulsa el corazon de un archivo para guardarlo aqui.' : 'Los archivos que muevas a la papelera apareceran aqui.';
  document.getElementById('item-count').textContent = filtered.length + ' elemento' + (filtered.length === 1 ? '' : 's');
  document.getElementById('sidebar-path').textContent = mode === 'favorites' ? 'Favoritos' : 'Papelera';
  document.getElementById('storage-label').textContent = mode === 'favorites' ? 'Archivos marcados con corazon' : 'Elementos eliminados recientemente';
  document.getElementById('folder-button').hidden = true;
  document.querySelector('.upload-control').hidden = true;
  document.getElementById('drop-hint').hidden = true;
  document.querySelectorAll('#cloud-menu [data-view]').forEach((button) => button.classList.toggle('active', button.dataset.view === mode));
  decorateSelection();
}
async function openCustom(mode) {
  setMenu(false);
  custom.selected.clear();
  setSelectionMode(false);
  try {
    const data = mode === 'favorites' ? await loadFavoriteRows() : await json('/api/trash');
    renderCustom(data, mode);
  } catch (error) {
    setStatus(error.message, true);
  }
}
async function toggleFavorite(button) {
  const path = button.dataset.path || currentPath();
  const name = button.dataset.name;
  const isFavorite = button.classList.contains('is-favorite') || custom.favorites.has(favoriteKey(path, name));
  await json('/api/favorites', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, name, type: 'file', favorite: !isFavorite }),
  });
  if (custom.mode === 'favorites') await openCustom('favorites');
  else {
    if (isFavorite) custom.favorites.delete(favoriteKey(path, name));
    else custom.favorites.add(favoriteKey(path, name));
    decorateFiles();
  }
  setStatus(isFavorite ? 'Quitado de favoritos.' : 'Anadido a favoritos.');
}
async function download(name, path) {
  const data = await json('/api/download-link?path=' + encodeURIComponent(path) + '&name=' + encodeURIComponent(name) + '&mode=download');
  const response = await fetch(new URL(data.url, location.origin), { headers: { Authorization: 'Bearer ' + await token() } });
  if (!response.ok) throw Error('No se pudo descargar el archivo.');
  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  setStatus('Descarga iniciada.');
}
async function restore(id) {
  await json('/api/trash/restore', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
  await openCustom('trash');
  setStatus('Elemento restaurado.');
}
async function purge(id, name) {
  if (!confirm('Eliminar "' + name + '" para siempre?')) return;
  await api('/api/trash/item?id=' + encodeURIComponent(id), { method: 'DELETE' });
  await openCustom('trash');
  setStatus('Elemento eliminado definitivamente.');
}
function decorateFiles() {
  if (custom.mode !== 'files') return;
  const path = currentPath();
  document.querySelectorAll('.mini[data-action="preview"]').forEach((button) => {
    const name = button.dataset.name;
    const favorite = custom.favorites.has(favoriteKey(path, name));
    button.dataset.action = 'favorite';
    button.dataset.path = path;
    button.dataset.type = 'file';
    button.classList.add('favorite-button');
    button.classList.toggle('is-favorite', favorite);
    button.title = favorite ? 'Quitar de favoritos' : 'Anadir a favoritos';
    button.innerHTML = '<i class="ph ' + (favorite ? 'ph-heart-fill' : 'ph-heart') + '"></i>';
  });
  decorateSelection();
}
function showFiles() {
  if (custom.mode !== 'files') location.reload();
  setMenu(false);
}
document.addEventListener('click', (event) => {
  const actionItem = event.target.closest('[data-action-menu]');
  if (actionItem) {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!actionItem.disabled) runActionMenu(actionItem.dataset.actionMenu).catch((error) => setStatus(error.message, true));
    return;
  }
  const actionTrigger = event.target.closest('.search-actions-trigger');
  if (actionTrigger) {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (actionMenuState.element && !actionMenuState.element.hidden) closeActionMenu();
    else openActionMenu(null, actionTrigger);
    return;
  }
  if (actionMenuState.element && !actionMenuState.element.hidden && !event.target.closest('.cloud-action-menu')) {
    closeActionMenu();
  }
  const selectionButton = event.target.closest('#selection-mode-button');
  if (selectionButton) {
    event.preventDefault();
    event.stopImmediatePropagation();
    setSelectionMode(!custom.selectionMode);
    return;
  }
  const node = event.target.closest('.file-card[data-name], .list-row[data-selectable]');
  const cardSurface = node && !event.target.closest('button, a, input, select, textarea');
  if (custom.suppressNextClick) {
    custom.suppressNextClick = false;
    if (cardSurface) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
  }
  if (cardSurface && (custom.selectionMode || event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    event.stopImmediatePropagation();
    toggleSelected(node);
    return;
  }
  const menu = document.getElementById('cloud-menu');
  if (menu && !menu.hidden && !event.target.closest('#cloud-menu') && !event.target.closest('#menu-button')) {
    setMenu(false);
    return;
  }
  const menuButton = event.target.closest('#menu-button');
  if (menuButton) {
    event.preventDefault();
    event.stopImmediatePropagation();
    setMenu(document.getElementById('cloud-menu').hidden);
    return;
  }
  const view = event.target.closest('#cloud-menu [data-view]');
  if (view) {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (view.dataset.view === 'files') showFiles();
    else openCustom(view.dataset.view);
    return;
  }
  const logout = event.target.closest('#menu-logout');
  if (logout) {
    event.preventDefault();
    event.stopImmediatePropagation();
    supabase.auth.signOut().then(() => location.reload());
    return;
  }
  const action = event.target.closest('[data-cloud-action]');
  if (!action) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const kind = action.dataset.cloudAction;
  const path = action.dataset.path || currentPath();
  const name = action.dataset.name;
  if (kind === 'favorite') toggleFavorite(action).catch((error) => setStatus(error.message, true));
  if (kind === 'download') download(name, path).catch((error) => setStatus(error.message, true));
  if (kind === 'restore') restore(action.dataset.id).catch((error) => setStatus(error.message, true));
  if (kind === 'purge') purge(action.dataset.id, name).catch((error) => setStatus(error.message, true));
}, true);
document.addEventListener('pointerdown', (event) => {
  const node = event.target.closest('.file-card[data-name], .list-row[data-selectable]');
  if (!node || event.target.closest('button, a, input, select, textarea')) return;
  clearTimeout(custom.pressTimer);
  custom.pressTimer = setTimeout(() => {
    custom.suppressNextClick = true;
    toggleSelected(node);
    openActionMenu(selectionInfo(node), node);
    if (navigator.vibrate) navigator.vibrate(20);
  }, 550);
}, true);
document.addEventListener('pointerup', () => clearTimeout(custom.pressTimer), true);
document.addEventListener('pointercancel', () => clearTimeout(custom.pressTimer), true);
document.addEventListener('contextmenu', (event) => {
  if (custom.selectionMode && event.target.closest('.file-card[data-name], .list-row[data-selectable]')) event.preventDefault();
}, true);
document.addEventListener('click', (event) => {
  if (custom.mode === 'files' && event.target.closest('[data-path]')) {
    custom.path = currentPath();
    setTimeout(decorateFiles, 0);
  }
}, true);
document.getElementById('refresh-button').addEventListener('click', (event) => {
  if (custom.mode !== 'files') {
    event.preventDefault();
    event.stopImmediatePropagation();
    openCustom(custom.mode);
  }
}, true);
document.getElementById('search-input').addEventListener('input', (event) => {
  if (custom.mode !== 'files') {
    event.stopImmediatePropagation();
    renderCustom(custom.data, custom.mode);
  }
}, true);
loadFavoriteRows().then(() => decorateFiles()).catch(() => {});
supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_IN') loadFavoriteRows().then(() => decorateFiles()).catch(() => {});
  if (event === 'SIGNED_OUT') window.HRCloudLocalSession?.revoke?.();
});
const observer = new MutationObserver(() => decorateFiles());
observer.observe(document.getElementById('grid'), { childList: true, subtree: true });
ensureSelectionControls();
ensureActionControls();
updateSelectionControls();
decorateSelection();
addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    setMenu(false);
    closeActionMenu();
  }
});
