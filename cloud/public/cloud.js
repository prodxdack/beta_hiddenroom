import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const SUPABASE_URL = "https://rpcunbkstadgngqrjafp.supabase.co";
const SUPABASE_KEY = "sb_publishable_7v_FIgTjWjJgtT1YHIAYSw_bRBmQjZO";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const state = { path: '/', entries: null, meta: null };
const loginView = document.getElementById('login-view');
const appView = document.getElementById('app-view');
const loginForm = document.getElementById('login-form');
const loginMessage = document.getElementById('login-message');
const statusMessage = document.getElementById('status-message');
const fileBody = document.getElementById('file-body');
const breadcrumb = document.getElementById('breadcrumb');
const fileInput = document.getElementById('file-input');
const uploadButton = document.querySelector('.upload-button');
const folderButton = document.getElementById('folder-button');
const shareDialog = document.getElementById('share-dialog');
const shareDialogTitle = document.getElementById('share-dialog-title');
const shareDialogLinkPanel = document.getElementById('share-link-panel');
const shareDialogLinkInput = document.getElementById('share-link-input');
const shareDialogCopyButton = document.getElementById('share-copy-button');
const shareDialogSaveButton = document.getElementById('share-dialog-save');
let shareDialogState = { name: '', privacy: 'private', shareUrl: '' };

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
}
function formatSize(bytes) {
  const size = Number(bytes || 0);
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  return `${(size / 1024 / 1024 / 1024).toFixed(1)} GB`;
}
function formatDate(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}
function normalizePath(path) {
  if (!path || path === '/') return '/';
  let normalized = String(path).replace(/\\/g, '/').replace(/\/+/g, '/');
  if (!normalized.startsWith('/')) normalized = `/${normalized}`;
  if (normalized !== '/' && normalized.endsWith('/')) normalized = normalized.slice(0, -1);
  return normalized;
}
function childPath(name) { return state.path === '/' ? `/${name}` : `${state.path}/${name}`; }
function parentPath() {
  const current = normalizePath(state.path);
  if (current === '/') return '/';
  const parts = current.split('/').filter(Boolean);
  parts.pop();
  return parts.length ? `/${parts.join('/')}` : '/';
}
function setMessage(message, isError = false) {
  statusMessage.textContent = message || '';
  statusMessage.classList.toggle('error', Boolean(isError));
}
function isIosSafari() {
  const ua = navigator.userAgent || '';
  const isAppleMobile = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return isAppleMobile && /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS/i.test(ua);
}

function setActionsEnabled(canUpload) {
  if (uploadButton) uploadButton.hidden = !canUpload;
  if (folderButton) folderButton.hidden = !canUpload;
}
function applyMeta(meta) {
  if (!meta) return;
  state.meta = meta;
  setActionsEnabled(Boolean(meta.canUpload));
}

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Sesion requerida.');
  return { Authorization: `Bearer ${session.access_token}` };
}
async function api(path, options = {}) {
  const headers = { ...(await authHeaders()), ...(options.headers || {}) };
  const response = await fetch(path, { ...options, headers });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.error || `Error ${response.status}`);
  }
  return response;
}
async function apiJson(path, options = {}) { return (await api(path, options)).json(); }

function renderBreadcrumb() {
  const current = normalizePath(state.path);
  const parts = current === '/' ? [] : current.slice(1).split('/');
  const items = [{ label: state.meta?.rootLabel || 'Root', path: '/' }];
  let walk = '';
  for (const part of parts) {
    walk += `/${part}`;
    items.push({ label: part, path: walk });
  }
  breadcrumb.innerHTML = items.map((item) => `<button type="button" data-path="${escapeHtml(item.path)}">${escapeHtml(item.label)}</button>`).join('');
}
function privacyLabel(value) {
  return { private: 'Privado', public: 'Público', link: 'Cualquiera con el enlace' }[value] || 'Privado';
}
function rowTemplate(item, type) {
  const isFolder = type === 'folder';
  const writeActions = state.meta?.canUpload ? `
        <button type="button" data-action="rename" data-type="${type}" data-name="${escapeHtml(item.name)}">Renombrar</button>
        <button class="danger" type="button" data-action="delete" data-type="${type}" data-name="${escapeHtml(item.name)}">Eliminar</button>` : '';
  const privacy = item.privacy || 'private';
  const sharingCell = !isFolder && state.meta?.canManageSharing ? `
        <button class="share-button" type="button" data-action="share" data-name="${escapeHtml(item.name)}">Compartir</button>
        <span class="privacy-status">Estado: ${escapeHtml(privacyLabel(privacy))}</span>
        ${item.share_url ? `<div class="share-actions"><a href="${escapeHtml(item.share_url)}" target="_blank" rel="noopener noreferrer">Vista previa</a><button type="button" data-action="copy-share" data-url="${escapeHtml(item.share_url)}">Copiar enlace</button></div>` : '<small class="privacy-hint">Sin enlace compartido.</small>'}` : (isFolder ? '-' : 'Privado');
  return `
    <tr>
      <td class="name">${escapeHtml(item.name)}</td>
      <td>${isFolder ? 'Carpeta' : 'Archivo'}</td>
      <td>${isFolder ? '-' : escapeHtml(formatSize(item.size))}</td>
      <td>${escapeHtml(formatDate(item.modified))}</td>
      <td class="privacy-cell">${sharingCell}</td>
      <td><div class="row-actions">
        ${isFolder ? `<button type="button" data-action="open" data-name="${escapeHtml(item.name)}">Abrir</button>` : `<button type="button" data-action="download" data-name="${escapeHtml(item.name)}">Descargar</button>`}
        ${writeActions}
      </div></td>
    </tr>`;
}

async function setFileSharing(name, privacy) {
  if (!state.meta?.canManageSharing) return null;
  return apiJson('/api/file-sharing', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: state.path, name, privacy }),
  });
}
async function copyShareLink(url) {
  if (!url) return;
  try { await navigator.clipboard.writeText(url); } catch {
    const input = document.createElement('textarea'); input.value = url; input.setAttribute('readonly', ''); input.style.position = 'fixed'; input.style.opacity = '0'; document.body.append(input); input.select(); document.execCommand('copy'); input.remove();
  }
  setMessage('Enlace copiado.');
}
function updateShareDialogLink() {
  const url = shareDialogState.shareUrl || '';
  shareDialogLinkPanel.hidden = !url; shareDialogCopyButton.disabled = !url; shareDialogLinkInput.value = url;
}
function openShareDialog(name, privacy = 'private', shareUrl = '') {
  shareDialogState = { name, privacy: privacy || 'private', shareUrl: shareUrl || '' };
  shareDialogTitle.textContent = name;
  shareDialog.querySelectorAll('input[name="share-privacy"]').forEach((input) => { input.checked = input.value === shareDialogState.privacy; });
  updateShareDialogLink(); shareDialog.showModal();
}
function closeShareDialog() { if (shareDialog.open) shareDialog.close(); }
async function saveShareDialog() {
  const selected = shareDialog.querySelector('input[name="share-privacy"]:checked');
  const privacy = selected?.value || 'private'; shareDialogSaveButton.disabled = true;
  try {
    const data = await setFileSharing(shareDialogState.name, privacy);
    shareDialogState.privacy = privacy; shareDialogState.shareUrl = data?.share_url || ''; updateShareDialogLink();
    await loadFiles(); setMessage(privacy === 'private' ? 'Archivo privado.' : 'Privacidad guardada. Enlace listo para copiar.');
  } catch (err) { setMessage(err.message || 'No se pudo actualizar la privacidad.', true); }
  finally { shareDialogSaveButton.disabled = false; }
}
function renderFiles(data) {
  const folders = Array.isArray(data.folders) ? data.folders : [];
  const files = Array.isArray(data.files) ? data.files : [];
  renderBreadcrumb();
  if (!folders.length && !files.length) {
    fileBody.innerHTML = '<tr><td class="empty" colspan="6">No hay archivos en esta carpeta.</td></tr>';
    return;
  }
  fileBody.innerHTML = [...folders.map((folder) => rowTemplate(folder, 'folder')), ...files.map((file) => rowTemplate(file, 'file'))].join('');
}
async function loadFiles(path = state.path) {
  state.path = normalizePath(path);
  setMessage('Cargando...');
  const data = await apiJson(`/api/files?path=${encodeURIComponent(state.path)}`);
  applyMeta(data.meta);
  state.entries = data;
  renderFiles(data);
  setMessage('');
}
async function createFolder() {
  if (!state.meta?.canUpload) return;
  const name = prompt('Nombre de la carpeta');
  if (!name) return;
  await apiJson('/api/folders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: state.path, name }) });
  await loadFiles();
}
async function uploadOneFile(file, index, total) {
  const prefix = total > 1 ? `${index + 1}/${total}: ` : '';
  setMessage(`Subiendo ${prefix}${file.name}...`);
  await apiJson(`/api/upload?path=${encodeURIComponent(state.path)}`, {
    method: 'POST',
    headers: { 'X-File-Name': encodeURIComponent(file.name), 'Content-Type': file.type || 'application/octet-stream' },
    body: file,
  });
}

async function uploadFiles(fileList) {
  if (!state.meta?.canUpload) return;
  const files = Array.from(fileList || []).filter(Boolean);
  if (!files.length) return;

  fileInput.disabled = true;
  if (uploadButton) uploadButton.classList.add('is-uploading');
  try {
    for (const [index, file] of files.entries()) {
      await uploadOneFile(file, index, files.length);
    }
    setMessage(files.length === 1 ? 'Archivo subido.' : `${files.length} archivos subidos.`);
    await loadFiles();
  } finally {
    fileInput.value = '';
    fileInput.disabled = false;
    if (uploadButton) uploadButton.classList.remove('is-uploading');
  }
}
async function renameItem(type, name) {
  if (!state.meta?.canUpload) return;
  const dot = type === 'file' ? name.lastIndexOf('.') : -1;
  const extension = dot > 0 && dot < name.length - 1 ? name.slice(dot) : '';
  const stem = extension ? name.slice(0, -extension.length) : name;
  const enteredName = prompt(extension ? 'Nuevo nombre (se conservará ' + extension + ')' : 'Nuevo nombre', stem);
  if (!enteredName || enteredName.trim() === stem) return;
  const trimmedName = enteredName.trim();
  const newName = extension && !trimmedName.toLowerCase().endsWith(extension.toLowerCase()) ? trimmedName + extension : trimmedName;
  await apiJson('/api/rename', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: state.path, type, name, newName }) });
  await loadFiles();
}
async function deleteItem(type, name) {
  if (!state.meta?.canUpload) return;
  if (!confirm(`Eliminar ${name}?`)) return;
  await apiJson(`/api/item?path=${encodeURIComponent(state.path)}&type=${encodeURIComponent(type)}&name=${encodeURIComponent(name)}`, { method: 'DELETE' });
  await loadFiles();
}
async function downloadFile(name) {
  setMessage(`Preparando ${name}...`);
  const query = `path=${encodeURIComponent(state.path)}&name=${encodeURIComponent(name)}`;
  if (isIosSafari()) {
    const data = await apiJson(`/api/download-link?${query}`);
    window.location.assign(data.url);
    setMessage('');
    return;
  }

  const response = await api(`/api/download?${query}`);
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  setMessage('');
}
async function showAppIfSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    loginView.hidden = false;
    appView.hidden = true;
    setActionsEnabled(false);
    return;
  }

  loginView.hidden = true;
  appView.hidden = false;
  try {
    applyMeta(await apiJson('/api/session'));
    await loadFiles(state.meta?.homePath || '/');
  } catch (err) {
    setMessage(err.message || 'No se pudo cargar MysAuth Cloud.', true);
  }
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  loginMessage.textContent = 'Entrando...';
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) { loginMessage.textContent = error.message; return; }
  loginMessage.textContent = '';
  await showAppIfSession();
});
document.getElementById('logout-button').addEventListener('click', async () => { await supabase.auth.signOut(); location.reload(); });
document.getElementById('refresh-button').addEventListener('click', () => loadFiles().catch((err) => setMessage(err.message, true)));
folderButton.addEventListener('click', () => createFolder().catch((err) => setMessage(err.message, true)));
document.getElementById('up-button').addEventListener('click', () => loadFiles(parentPath()).catch((err) => setMessage(err.message, true)));
fileInput.addEventListener('change', () => uploadFiles(fileInput.files).catch((err) => setMessage(err.message, true)));
breadcrumb.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-path]');
  if (button) loadFiles(button.dataset.path).catch((err) => setMessage(err.message, true));
});
fileBody.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const { action, type, name } = button.dataset;
  if (action === 'open') loadFiles(childPath(name)).catch((err) => setMessage(err.message, true));
  if (action === 'download') downloadFile(name).catch((err) => setMessage(err.message, true));
  if (action === 'rename') renameItem(type, name).catch((err) => setMessage(err.message, true));
  if (action === 'delete') deleteItem(type, name).catch((err) => setMessage(err.message, true));
  if (action === 'share') {
    const item = (state.entries?.files || []).find((entry) => entry.name === name);
    openShareDialog(name, item?.privacy || 'private', item?.share_url || '');
  }
  if (action === 'copy-share') copyShareLink(button.dataset.url).catch(() => setMessage('No se pudo copiar el enlace.', true));
});
shareDialog.querySelectorAll('input[name="share-privacy"]').forEach((input) => input.addEventListener('change', updateShareDialogLink));
document.getElementById('share-dialog-close').addEventListener('click', closeShareDialog);
document.getElementById('share-dialog-cancel').addEventListener('click', closeShareDialog);
shareDialogCopyButton.addEventListener('click', () => copyShareLink(shareDialogLinkInput.value).catch(() => setMessage('No se pudo copiar el enlace.', true)));
shareDialogSaveButton.addEventListener('click', () => saveShareDialog());
shareDialog.addEventListener('click', (event) => { if (event.target === shareDialog) closeShareDialog(); });
showAppIfSession().catch((err) => { loginView.hidden = false; appView.hidden = true; setActionsEnabled(false); loginMessage.textContent = err.message; });
