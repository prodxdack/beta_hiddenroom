
import { beatCardMarkup as sharedBeatCardMarkup } from "./beat-card.js?v=20261002-runtime-assets-v1";

const SUPABASE_URL = "https://rpcunbkstadgngqrjafp.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_7v_FIgTjWjJgtT1YHIAYSw_bRBmQjZO";
const CLOUD_ORIGIN = "https://cloud.hiddenroom.mx";
const CART_STORAGE_KEY = "hidden_room_store_cart";
const supabase = await window.HiddenRoomSupabase.getClient();

const profileSlug = new URLSearchParams(window.location.search).get("producer") || "";
const grid = document.getElementById("producer-beat-grid");
const modal = document.getElementById("beat-license-modal");
const modalTitle = document.getElementById("beat-license-modal-title");
const modalSubtitle = document.getElementById("beat-license-modal-subtitle");
const modalContent = document.getElementById("beat-license-modal-content");
const avatarActions = document.getElementById("producer-avatar-actions");
const avatarInput = document.getElementById("producer-avatar-file");
const avatarEditor = document.getElementById("producer-avatar-editor");
const avatarPreview = document.getElementById("producer-avatar-preview");
const avatarStage = document.getElementById("producer-avatar-stage");
const avatarZoom = document.getElementById("producer-avatar-zoom");
const avatarStatus = document.getElementById("producer-avatar-status");
const state = { profile: null, products: [], assignments: [], isOwner: false };
let avatarObjectUrl = "";
const avatarPointers = new Map();
let avatarPinchStart = null;
let avatarDragStart = null;
const avatarCropState = { x: 0.5, y: 0.5, zoom: 1 };

initProducerPage().catch((error) => {
  grid.innerHTML = errorState(error.message || "No se pudo cargar el productor.");
});

async function initProducerPage() {
  if (!profileSlug) throw new Error("Falta el productor en la URL.");
  state.profile = await fetchProducerProfile(profileSlug);
  if (!state.profile) throw new Error("Productor no encontrado.");
  const authResult = await supabase.auth.getSession().catch(() => ({ data: { session: null } }));
  const user = authResult?.data?.session?.user;
  state.isOwner = Boolean(user?.id && state.profile.user_id === user.id);
  renderProfile(state.profile);
  initAvatarEditor();
  state.products = await fetchProducerBeats(state.profile);
  state.assignments = await fetchBeatLicenseAssignments(state.products.map((product) => product.id));
  renderBeats();
  grid.addEventListener("click", handleGridClick);
  grid.addEventListener("keydown", handleGridKeydown);
  window.addEventListener("hr:beat-player-state", syncBeatCardPlayState);
  window.addEventListener("hr:beat-player-next", (event) => {
    const activeId = String(event.detail?.beatId || "");
    const activeSrc = String(event.detail?.src || "");
    const sequence = state.products.filter((product) => previewUrlForProduct(product));
    if (!sequence.length) return;
    const currentIndex = sequence.findIndex((product) => product.id === activeId || previewUrlForProduct(product) === activeSrc);
    const nextProduct = sequence[(currentIndex + 1 + sequence.length) % sequence.length];
    if (nextProduct) playBeat(nextProduct.id);
  });
  modal?.addEventListener("click", handleModalClick);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && modal && !modal.hidden) closeLicensesModal();
  });
}

async function fetchProducerProfile(slug) {
  const { data, error } = await supabase
    .from("producer_profiles")
    .select("id, user_id, slug, display_name, bio, avatar_url, cover_url, social_links")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function fetchProducerBeats(profile) {
  const { data, error } = await supabase
    .from("store_products")
    .select("id, slug, name, description, category, price, currency, image_url, beat_cover_path, beat_thumb_path, file_url, producer, producer_profile_id, beat_genre, beat_bpm, beat_key, beat_duration_seconds, beat_bpm_autodetected, beat_key_autodetected, beat_original_path, beat_preview_path, beat_preview_status, is_active, stock, featured, created_at")
    .eq("category", "beats")
    .eq("is_active", true)
    .order("featured", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const producerKeys = new Set([normalizeKey(profile.slug), normalizeKey(profile.display_name)].filter(Boolean));
  return (data ?? []).filter((product) => product.producer_profile_id === profile.id || producerKeys.has(normalizeKey(product.producer || "")));
}

async function fetchBeatLicenseAssignments(beatIds) {
  if (!beatIds.length) return [];
  const { data, error } = await supabase
    .from("beat_license_assignments")
    .select("id, beat_id, license_id, price, is_enabled, beat_licenses(id, name, description, terms, stream_limit, unlimited_streams, format, is_active)")
    .in("beat_id", beatIds)
    .eq("is_enabled", true);
  if (error) return [];
  return data ?? [];
}

function renderProfile(profile) {
  const displayName = producerDisplayName(profile.display_name);
  document.title = `${displayName} | Hidden Room Beat Store`;
  document.getElementById("producer-name").textContent = displayName;
  document.getElementById("producer-bio").textContent = profile.bio || "Catálogo de beats en Hidden Room.";
  const avatar = document.getElementById("producer-avatar");
  if (profile.avatar_url) {
    avatar.style.backgroundImage = `url(${escapeCssUrl(producerImageUrl(profile.avatar_url))})`;
    avatar.textContent = "";
  } else {
    avatar.style.backgroundImage = "";
    avatar.textContent = initials(profile.display_name);
  }
  if (avatarActions) avatarActions.hidden = !state.isOwner;
  const cover = document.getElementById("producer-cover");
  if (profile.cover_url) cover.style.backgroundImage = `url(${escapeCssUrl(profile.cover_url)})`;
  const links = socialLinks(profile.social_links);
  document.getElementById("producer-links").innerHTML = links.map((link) => `<a href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(link.label)}</a>`).join("");
}

function renderBeats() {
  if (!state.products.length) {
    grid.innerHTML = '<div class="empty-state beat-empty"><h2>Sin beats publicados</h2><p>Este productor todavía no tiene beats activos.</p></div>';
    return;
  }
  grid.innerHTML = state.products.map((product) => beatCardMarkup(product)).join("");
}

function beatCardMarkup(product) {
  const meta = itemMusicMeta(product);
  const canBuy = product.stock === null || Number(product.stock) > 0;
  const licensePrices = state.assignments
    .filter((assignment) => assignment.beat_id === product.id && assignment.beat_licenses?.is_active !== false)
    .map((assignment) => Number(assignment.price))
    .filter((price) => Number.isFinite(price) && price >= 0);
  const productPrice = Number(product.price);
  const startingPrice = licensePrices.length
    ? Math.min(...licensePrices)
    : (Number.isFinite(productPrice) && productPrice > 0 ? productPrice : null);
  const priceLabel = startingPrice === null
    ? "Precio por confirmar"
    : `Desde ${formatPrice(startingPrice, product.currency)}`;
  return sharedBeatCardMarkup({
    id: escapeHtml(product.id),
    title: escapeHtml(product.name),
    producerMarkup: escapeHtml(producerDisplayName(state.profile.display_name)),
    coverMarkup: coverMarkup(product),
    metaMarkup: musicMetaMarkup(meta),
    optionsMarkup: producerCardOptionsMarkup(product),
    priceLabel: escapeHtml(priceLabel),
    canBuy,
  });
}

function itemMusicMeta(product) {
  const bpmText = product.beat_bpm ? `${product.beat_bpm}${product.beat_bpm_autodetected ? " (AD)" : ""}` : "";
  const keyText = product.beat_key ? `${product.beat_key}${product.beat_key_autodetected ? " (AD)" : ""}` : "";
  return [
    product.beat_genre ? { label: "Género", value: product.beat_genre } : null,
    bpmText ? { label: "BPM", value: bpmText } : null,
    keyText ? { label: "Tonalidad", value: keyText } : null,
    product.beat_duration_seconds ? { label: "Duración", value: formatDuration(product.beat_duration_seconds) } : null,
  ].filter(Boolean);
}

function musicMetaMarkup(meta) {
  if (!meta.length) return '<p class="beat-card__music beat-card__music--empty">Género, BPM y tonalidad por confirmar</p>';
  return `<dl class="beat-card__music">${meta.map((entry) => `<div><dt>${escapeHtml(entry.label)}</dt><dd>${escapeHtml(entry.value)}</dd></div>`).join("")}</dl>`;
}

function coverMarkup(product) {
  const imageUrl = coverUrlForProduct(product);
  const canPreview = Boolean(previewUrlForProduct(product));
  const playAttrs = canPreview ? ` role="button" tabindex="0" data-play-beat="${escapeHtml(product.id)}" aria-label="Preview ${escapeHtml(product.name)}"` : "";
  const playOverlay = canPreview ? '<span class="beat-card__cover-play" aria-hidden="true">&#9658;</span>' : "";
  if (imageUrl) return `<div class="beat-card__cover"${playAttrs} aria-label="Portada de ${escapeHtml(product.name)}"><img src="${escapeHtml(imageUrl)}" alt="" loading="lazy" onerror="this.hidden=true;this.parentElement.classList.add('beat-card__cover--empty');this.nextElementSibling.hidden=false"><span class="beat-card__cover-fallback" hidden>${escapeHtml(initials(product.name))}</span>${playOverlay}</div>`;
  return `<div class="beat-card__cover beat-card__cover--empty"${playAttrs}><span>${escapeHtml(initials(product.name))}</span>${playOverlay}</div>`;
}

function coverUrlForProduct(product) {
  const raw = String(product.beat_cover_path || product.image_url || "").trim();
  if (!raw) return "";
  if (/^(?:https?:|data:|blob:)/i.test(raw)) return raw;
  if (raw.startsWith("/")) return new URL(raw, window.location.origin).href;
  const clean = raw.replaceAll("\\", "/").replace(/^beats_store\//i, "");
  return new URL(`/api/beat-store/stream?file=${encodeURIComponent(clean)}`, CLOUD_ORIGIN).href;
}

function producerImageUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^(?:https?:|data:|blob:)/i.test(raw)) return raw;
  if (/^\/api\/beat-store\/producer-avatar(?:\?|$)/i.test(raw)) return new URL(raw, CLOUD_ORIGIN).href;
  if (raw.startsWith("/")) return new URL(raw, window.location.origin).href;
  const clean = raw.replaceAll("\\", "/").replace(/^\/+/, "");
  if (/^users\/[0-9a-f-]{36}__[a-z0-9._-]+\/profile\/avatar\.webp$/i.test(clean)) {
    return new URL(`/api/beat-store/producer-avatar?file=${encodeURIComponent(clean)}`, CLOUD_ORIGIN).href;
  }
  return clean;
}
function previewUrlForProduct(product) {
  const preview = beatPreviewRelativeFile(product?.beat_preview_path);
  if (preview && product?.beat_preview_status !== "error") {
    return new URL(`/api/beat-store/stream?file=${encodeURIComponent(preview)}`, CLOUD_ORIGIN).href;
  }
  return "";
}

function beatPreviewRelativeFile(value) {
  const clean = beatRelativeFile(value);
  if (!clean) return "";
  return clean.toLowerCase().startsWith("previews/") && /\.mp3$/i.test(clean) ? clean : "";
}

function beatRelativeFile(value) {
  let clean = String(value || "").trim();
  if (!clean) return "";
  if (/^https?:\/\//i.test(clean)) {
    try {
      const url = new URL(clean);
      clean = url.searchParams.get("file") || url.pathname;
    } catch {
      return "";
    }
  }
  clean = clean.replaceAll("\\", "/").replace(/^\/+/, "");
  return clean.replace(/^beats_store\//i, "");
}

function handleGridClick(event) {
  const playButton = event.target.closest("[data-play-beat]");
  if (playButton) {
    toggleBeatPreview(playButton.dataset.playBeat);
    return;
  }
  const button = event.target.closest("[data-add-beat]");
  if (button) openLicensesModal(button.dataset.addBeat);
  const shareButton = event.target.closest("[data-share-beat]");
  if (shareButton) void shareProducerBeat(shareButton.dataset.shareBeat);
}

function producerCardOptionsMarkup(product) {
  if (!String(product?.slug || "").trim()) return "";
  return `
    <details class="beat-card__options">
      <summary aria-label="Opciones de ${escapeHtml(product.name || "Beat")}">
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 9L12 15L18 9"></path></svg>
      </summary>
      <div class="beat-card__options-menu">
        <button class="beat-card__share-action" type="button" data-share-beat="${escapeHtml(product.id)}">Compartir</button>
      </div>
    </details>`;
}

async function shareProducerBeat(productId) {
  const product = state.products.find((candidate) => candidate.id === productId);
  const slug = String(product?.slug || "").trim();
  if (!product || !slug) return;
  const url = new URL(`../product.html?slug=${encodeURIComponent(slug)}`, window.location.href).href;
  const shareData = { title: `${product.name || "Beat"} | Hidden Room`, text: `Escucha ${product.name || "este beat"} en Hidden Room.`, url };
  if (typeof navigator.share === "function") {
    try {
      await navigator.share(shareData);
      return;
    } catch (error) {
      if (error?.name === "AbortError") return;
    }
  }
  try {
    await copyTextToClipboard(url);
    showNotice("Enlace del beat copiado");
  } catch {
    showNotice("No se pudo copiar el enlace", true);
  }
}

async function copyTextToClipboard(value) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {
      // Fall back to the synchronous copy path.
    }
  }
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  Object.assign(textarea.style, { position: "fixed", opacity: "0", pointerEvents: "none" });
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("Clipboard unavailable");
}

function handleGridKeydown(event) {
  const playTarget = event.target.closest("[data-play-beat]");
  if (!playTarget || (event.key !== "Enter" && event.key !== " ")) return;
  event.preventDefault();
  toggleBeatPreview(playTarget.dataset.playBeat);
}

function toggleBeatPreview(productId) {
  const product = state.products.find((candidate) => candidate.id === productId);
  const previewUrl = previewUrlForProduct(product);
  if (!product || !previewUrl) return;
  if (window.HiddenRoomBeatPlayer?.src === previewUrl && window.HiddenRoomBeatPlayer?.isPlaying) {
    window.dispatchEvent(new CustomEvent("hr:beat-preview-toggle", { detail: { action: "pause" } }));
    return;
  }
  playBeat(productId);
}

function playBeat(productId) {
  const product = state.products.find((candidate) => candidate.id === productId);
  const previewUrl = previewUrlForProduct(product);
  if (!product || !previewUrl) return;
  window.dispatchEvent(new CustomEvent("hr:beat-preview", {
    detail: {
      src: previewUrl,
      title: product.name || "Beat",
      detail: producerDisplayName(state.profile.display_name),
      cover: coverUrlForProduct(product),
      genre: product.beat_genre || product.genre || "",
    },
  }));
}

function syncBeatCardPlayState(event) {
  const activeSrc = event.detail?.src || "";
  const isPlaying = Boolean(event.detail?.isPlaying);
  document.querySelectorAll(".beat-card__cover[data-play-beat]").forEach((cover) => {
    const product = state.products.find((candidate) => candidate.id === cover.dataset.playBeat);
    const isActive = previewUrlForProduct(product) === activeSrc;
    cover.classList.toggle("is-playing", isActive && isPlaying);
    cover.closest(".beat-card")?.classList.toggle("is-active", isActive);
    const icon = cover.querySelector(".beat-card__cover-play");
    if (icon) icon.innerHTML = isActive && isPlaying ? "&#10074;&#10074;" : "&#9658;";
  });
}

function initAvatarEditor() {
  if (!state.isOwner || !avatarInput || !avatarEditor || !avatarPreview || !avatarStage) return;
  avatarInput.addEventListener("change", handleAvatarSelection);
  document.getElementById("producer-avatar-reset")?.addEventListener("click", resetAvatarCrop);
  document.getElementById("producer-avatar-cancel")?.addEventListener("click", cancelAvatarSelection);
  document.getElementById("producer-avatar-save")?.addEventListener("click", saveAvatarSelection);
  avatarZoom?.addEventListener("input", () => {
    avatarCropState.zoom = Number(avatarZoom.value) || 1;
    updateAvatarPreview();
  });
  avatarStage.addEventListener("pointerdown", handleAvatarPointerDown);
  avatarStage.addEventListener("pointermove", handleAvatarPointerMove);
  avatarStage.addEventListener("pointerup", handleAvatarPointerEnd);
  avatarStage.addEventListener("pointercancel", handleAvatarPointerEnd);
  avatarStage.addEventListener("wheel", handleAvatarWheel, { passive: false });
}

function handleAvatarSelection() {
  const file = avatarInput?.files?.[0];
  clearAvatarObjectUrl();
  if (!file) {
    avatarEditor.hidden = true;
    return;
  }
  if ((!file.type.startsWith("image/") && !/\.(jpg|jpeg|png|webp)$/i.test(file.name)) || file.size > 12 * 1024 * 1024) {
    setAvatarStatus(file.size > 12 * 1024 * 1024 ? "La imagen supera el límite de 12 MB." : "Selecciona una imagen válida.", true);
    avatarInput.value = "";
    avatarEditor.hidden = true;
    return;
  }
  avatarObjectUrl = URL.createObjectURL(file);
  avatarPreview.src = avatarObjectUrl;
  avatarPreview.onload = updateAvatarPreview;
  avatarEditor.hidden = false;
  setAvatarStatus("");
  resetAvatarCrop();
}

function clearAvatarObjectUrl() {
  if (avatarObjectUrl) URL.revokeObjectURL(avatarObjectUrl);
  avatarObjectUrl = "";
}

function resetAvatarCrop() {
  avatarCropState.x = 0.5;
  avatarCropState.y = 0.5;
  avatarCropState.zoom = 1;
  if (avatarZoom) avatarZoom.value = "1";
  updateAvatarPreview();
}

function avatarImageRatio() {
  return (avatarPreview?.naturalWidth || 1) / (avatarPreview?.naturalHeight || 1);
}

function avatarAxisCanMove() {
  const ratio = avatarImageRatio();
  const zoom = avatarCropState.zoom;
  return {
    x: Math.max(ratio, 1) * zoom > 1.001,
    y: Math.max(1 / ratio, 1) * zoom > 1.001,
  };
}

function clampAvatarCrop() {
  avatarCropState.zoom = Math.max(1, Math.min(3, avatarCropState.zoom));
  const movable = avatarAxisCanMove();
  avatarCropState.x = movable.x ? Math.max(0, Math.min(1, avatarCropState.x)) : 0.5;
  avatarCropState.y = movable.y ? Math.max(0, Math.min(1, avatarCropState.y)) : 0.5;
}

function updateAvatarPreview() {
  if (!avatarPreview) return;
  clampAvatarCrop();
  const { x, y, zoom } = avatarCropState;
  const extraPan = zoom > 1 ? ((zoom - 1) / zoom) * 50 : 0;
  avatarPreview.style.objectPosition = `${x * 100}% ${y * 100}%`;
  avatarPreview.style.transform = `translate(${(0.5 - x) * extraPan}%, ${(0.5 - y) * extraPan}%) scale(${zoom})`;
}

function avatarPointerSnapshot(event) {
  return { x: event.clientX, y: event.clientY };
}

function avatarPointerDistance() {
  const points = Array.from(avatarPointers.values());
  if (points.length < 2) return 0;
  return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
}

function handleAvatarPointerDown(event) {
  if (!avatarPreview?.src || !avatarStage) return;
  event.preventDefault();
  avatarStage.setPointerCapture?.(event.pointerId);
  avatarStage.classList.add("is-dragging");
  avatarPointers.set(event.pointerId, avatarPointerSnapshot(event));
  if (avatarPointers.size === 2) {
    avatarPinchStart = { distance: avatarPointerDistance(), zoom: avatarCropState.zoom };
    avatarDragStart = null;
    return;
  }
  avatarDragStart = { x: event.clientX, y: event.clientY, cropX: avatarCropState.x, cropY: avatarCropState.y };
}

function handleAvatarPointerMove(event) {
  if (!avatarPointers.has(event.pointerId) || !avatarStage) return;
  event.preventDefault();
  avatarPointers.set(event.pointerId, avatarPointerSnapshot(event));
  if (avatarPointers.size >= 2 && avatarPinchStart?.distance) {
    avatarCropState.zoom = avatarPinchStart.zoom * (avatarPointerDistance() / avatarPinchStart.distance);
    if (avatarZoom) avatarZoom.value = String(avatarCropState.zoom);
    updateAvatarPreview();
    return;
  }
  if (!avatarDragStart) return;
  const rect = avatarStage.getBoundingClientRect();
  const movable = avatarAxisCanMove();
  const dragRangeX = movable.x ? Math.max(0.25, avatarCropState.zoom - 0.5) : Number.POSITIVE_INFINITY;
  const dragRangeY = movable.y ? Math.max(0.25, avatarCropState.zoom - 0.5) : Number.POSITIVE_INFINITY;
  avatarCropState.x = avatarDragStart.cropX - ((event.clientX - avatarDragStart.x) / Math.max(1, rect.width) / dragRangeX);
  avatarCropState.y = avatarDragStart.cropY - ((event.clientY - avatarDragStart.y) / Math.max(1, rect.height) / dragRangeY);
  updateAvatarPreview();
}

function handleAvatarPointerEnd(event) {
  avatarPointers.delete(event.pointerId);
  avatarStage?.releasePointerCapture?.(event.pointerId);
  if (avatarPointers.size < 2) avatarPinchStart = null;
  if (!avatarPointers.size) {
    avatarDragStart = null;
    avatarStage?.classList.remove("is-dragging");
  }
}

function handleAvatarWheel(event) {
  if (!avatarPreview?.src) return;
  event.preventDefault();
  avatarCropState.zoom += event.deltaY < 0 ? 0.08 : -0.08;
  if (avatarZoom) avatarZoom.value = String(avatarCropState.zoom);
  updateAvatarPreview();
}

function currentAvatarCrop() {
  clampAvatarCrop();
  return { x: avatarCropState.x, y: avatarCropState.y, size: 1 / avatarCropState.zoom };
}

async function saveAvatarSelection() {
  const file = avatarInput?.files?.[0];
  if (!file || !state.isOwner) return;
  const saveButton = document.getElementById("producer-avatar-save");
  saveButton.disabled = true;
  setAvatarStatus("Procesando foto...");
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error("Sesión requerida para cambiar la foto.");
    const endpoint = new URL(`${CLOUD_ORIGIN}/api/beat-store/producer-avatar`);
    endpoint.searchParams.set("profile_id", state.profile.id);
    endpoint.searchParams.set("crop", JSON.stringify(currentAvatarCrop()));
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": file.type || "application/octet-stream",
      },
      body: file,
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "No se pudo procesar la foto.");
    state.profile.avatar_url = result.avatar_url || state.profile.avatar_url;
    renderProfile(state.profile);
    cancelAvatarSelection();
    showNotice("Foto de perfil actualizada");
  } catch (error) {
    setAvatarStatus(error.message || "No se pudo guardar la foto.", true);
  } finally {
    saveButton.disabled = false;
  }
}

function cancelAvatarSelection() {
  clearAvatarObjectUrl();
  if (avatarInput) avatarInput.value = "";
  if (avatarPreview) avatarPreview.removeAttribute("src");
  if (avatarEditor) avatarEditor.hidden = true;
  setAvatarStatus("");
}

function setAvatarStatus(message, isError = false) {
  if (!avatarStatus) return;
  avatarStatus.textContent = message;
  avatarStatus.classList.toggle("is-error", Boolean(isError));
}

function openLicensesModal(productId) {
  const product = state.products.find((candidate) => candidate.id === productId);
  if (!product) return;
  modalTitle.textContent = product.name;
  modalSubtitle.textContent = producerDisplayName(state.profile.display_name);
  modalContent.innerHTML = beatLicensesContentMarkup(product);
  if (modal.parentElement !== document.body) document.body.appendChild(modal);
  modal.hidden = false;
  document.body.classList.add("beat-license-modal-open");
}

function closeLicensesModal() {
  modal.hidden = true;
  document.body.classList.remove("beat-license-modal-open");
  modalContent.innerHTML = "";
}

function handleModalClick(event) {
  if (event.target.closest("[data-license-modal-close]")) closeLicensesModal();
  const buyButton = event.target.closest("[data-buy-license]");
  const addButton = event.target.closest("[data-add-license]");
  if (buyButton) {
    if (addLicenseToCart(buyButton.dataset.buyLicense, buyButton.dataset.licenseId)) window.location.assign("../cart.html");
    return;
  }
  if (addButton) addLicenseToCart(addButton.dataset.addLicense, addButton.dataset.licenseId);
}

function addLicenseToCart(productId, licenseId) {
  const product = state.products.find((candidate) => candidate.id === productId);
  const assignment = state.assignments.find((candidate) => candidate.beat_id === productId && candidate.license_id === licenseId && candidate.is_enabled !== false && candidate.beat_licenses?.is_active !== false);
  const license = assignment?.beat_licenses;
  if (!product || !assignment || !license) return false;

  let cart = [];
  try {
    const stored = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || "[]");
    cart = Array.isArray(stored) ? stored : [];
  } catch {
    cart = [];
  }

  const existing = cart.find((entry) => entry?.id === product.id && entry?.license_id === licenseId);
  if (existing) {
    showNotice("Esta licencia ya esta en tu carrito");
    return true;
  }

  cart.push({
    id: product.id,
    beat_id: product.id,
    license_id: licenseId,
    license_price: Number(assignment.price),
    license_name: license.name || "Licencia",
    license_description: license.description || "",
    license_format: license.format || "",
    license_terms: license.terms || "",
    beat_producer: producerDisplayName(state.profile.display_name),
    quantity: 1,
  });
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  document.querySelectorAll(".cart-count").forEach((element) => { element.textContent = String(cart.reduce((sum, entry) => sum + Math.max(1, Number(entry?.quantity) || 1), 0)); });
  window.dispatchEvent(new CustomEvent("hr:store-cart-updated"));
  showNotice("Licencia agregada al carrito");
  return true;
}

function beatLicensesContentMarkup(product) {
  const licenses = state.assignments
    .filter((assignment) => assignment.beat_id === product.id && assignment.beat_licenses?.is_active !== false)
    .map((assignment) => ({
      id: assignment.license_id,
      name: assignment.beat_licenses?.name || "Licencia",
      description: assignment.beat_licenses?.description || "Licencia disponible para este beat.",
      price: Number(assignment.price),
      streams: streamLimitLabel(assignment.beat_licenses),
      format: assignment.beat_licenses?.format || "",
      terms: assignment.beat_licenses?.terms || "",
    }));
  if (!licenses.length) return '<p class="beat-license-empty">Este beat todavía no tiene licencias habilitadas.</p>';
  return `<div class="beat-license-list">${licenses.map((license) => `
    <article class="beat-license-option">
      <header><div><h5>${escapeHtml(license.name)}</h5><p>${escapeHtml(license.description)}</p></div><strong>${escapeHtml(formatPrice(license.price, product.currency))}</strong></header>
      <dl><div><dt>Límite</dt><dd>${escapeHtml(license.streams)}</dd></div>${license.format ? `<div><dt>Formato</dt><dd>${escapeHtml(license.format)}</dd></div>` : ""}</dl>
      ${license.terms ? `<p class="beat-license-terms">${escapeHtml(license.terms)}</p>` : ""}
      <div class="beat-license-actions"><button class="primary-button" type="button" data-buy-license="${escapeHtml(product.id)}" data-license-id="${escapeHtml(license.id)}">Comprar ahora</button><button class="secondary-button" type="button" data-add-license="${escapeHtml(product.id)}" data-license-id="${escapeHtml(license.id)}">Añadir al carrito</button></div>
    </article>`).join("")}</div>`;
}

function streamLimitLabel(license) {
  if (!license) return "Por confirmar";
  if (license.unlimited_streams) return "Ilimitados";
  const limit = Number(license.stream_limit);
  return Number.isFinite(limit) ? `${new Intl.NumberFormat("es-MX").format(limit)} streams` : "Por confirmar";
}

function socialLinks(raw) {
  const links = raw && typeof raw === "object" ? raw : {};
  return Object.entries(links)
    .map(([label, url]) => ({ label, url: String(url || "") }))
    .filter((link) => /^https?:\/\//i.test(link.url))
    .slice(0, 6);
}

function formatDuration(value) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return "";
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}

function formatPrice(amount, currency = "MXN") {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: currency || "MXN" }).format(Number(amount));
}

function producerStorageName(value) {
  return String(value || "").trim().replace(/^@+/, "");
}

function producerDisplayName(value) {
  const clean = producerStorageName(value);
  return clean ? `@${clean}` : "Productor por confirmar";
}
function normalizeKey(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
function initials(value) {
  return String(value || "HR").trim().split(/\s+/).slice(0, 2).map((word) => word[0] || "").join("").toUpperCase();
}

function elevateStoreNotice(notice) {
  document.body.append(notice);
  Object.assign(notice.style, {
    position: "fixed",
    right: "max(16px, env(safe-area-inset-right))",
    bottom: "calc(var(--hr-beat-player-offset, 0px) + max(16px, env(safe-area-inset-bottom)))",
    zIndex: "2147483647",
    display: "grid",
    pointerEvents: "auto",
  });
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;" }[char]));
}

function escapeCssUrl(value) {
  return String(value || "").replace(/["\\\n\r]/g, "");
}

function errorState(message) {
  return `<div class="empty-state beat-empty"><h2>No pudimos cargar el productor</h2><p>${escapeHtml(message)}</p></div>`;
}

function showNotice(message) {
  const notice = document.getElementById("store-notice");
  if (!notice) return;
  elevateStoreNotice(notice);
  notice.className = "notice hr-toast hr-toast--success visible hr-toast--visible";
  notice.textContent = message;
  window.clearTimeout(showNotice.timer);
  showNotice.timer = window.setTimeout(() => notice.classList.remove("visible", "hr-toast--visible"), 2200);
}
