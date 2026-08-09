
const SUPABASE_URL = "https://rpcunbkstadgngqrjafp.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_7v_FIgTjWjJgtT1YHIAYSw_bRBmQjZO";
const CART_STORAGE_KEY = "hidden_room_store_cart";
const CLOUD_ORIGIN = "https://cloud.hiddenroom.mx";
const BEAT_STORE_ENDPOINT = `${CLOUD_ORIGIN}/api/beat-store`;
const ANALYZE_BEAT_AUDIO_ENDPOINT = `${SUPABASE_URL}/functions/v1/analyze-beat-audio`;
const BEAT_STORE_CLOUD_PATH = "/beats_store";
const supabase = await window.HiddenRoomSupabase.getClient();
const hrBeatStoreLifecycle = new AbortController();
window.HiddenRoomApp?.register(() => hrBeatStoreLifecycle.abort());
const state = { products: [], adminProducts: [], beats: [], items: [], searchIndex: new Map(), genreIndex: new Map(), renderVersion: 0, renderedKey: "", licenses: [], assignments: [], producerProfiles: [], durationDetections: new Set(), isAdmin: false, currentUserId: null, currentUsername: "", hasBeatMetadata: true, hasBeatLicenses: true, hasBeatPreviews: true, hasBeatAutodetectFlags: true };

const grid = document.getElementById("beat-grid");
const searchInput = document.getElementById("beat-search");
const sortSelect = document.getElementById("beat-sort");
const genreSelect = document.getElementById("beat-genre");
const producerSelect = document.getElementById("beat-producer-filter");
const priceMinInput = document.getElementById("beat-price-min");
const priceMaxInput = document.getElementById("beat-price-max");
const bpmMinInput = document.getElementById("beat-bpm-min");
const bpmMaxInput = document.getElementById("beat-bpm-max");
const resultStatus = document.getElementById("beat-results-status");
const clearFiltersButton = document.getElementById("beat-clear-filters");
const adminPanel = document.getElementById("beat-admin-panel");
const adminForm = document.getElementById("beat-admin-form");
const adminList = document.getElementById("beat-admin-products");
const adminStatus = document.getElementById("beat-admin-status");
const adminError = document.getElementById("beat-admin-error");
const cancelEditButton = document.getElementById("beat-cancel-edit");
const beatUploadInput = document.getElementById("beat-upload-file");
const beatCoverInput = document.getElementById("beat-cover-file");
const beatUploadStatus = document.getElementById("beat-upload-status");
const beatSubmitButton = document.getElementById("beat-submit-button");
const beatProducerProfileButton = document.querySelector("[data-producer-profile-current]");
const beatProducerUsernameButton = document.querySelector("[data-use-current-username]");
const beatCoverEditor = document.getElementById("beat-cover-editor");
const beatCoverPreview = document.getElementById("beat-cover-preview");
const beatCoverStage = document.querySelector(".beat-cover-editor__stage");
const beatLicenseAssignmentList = document.getElementById("beat-license-assignment-list");
const beatLicenseForm = document.getElementById("beat-license-form");
const beatLicenseList = document.getElementById("beat-license-list");
const beatLicenseStatus = document.getElementById("beat-license-status");
const beatLicenseError = document.getElementById("beat-license-error");
const beatLicenseWarning = document.getElementById("beat-license-warning");
const beatLicenseCancel = document.getElementById("beat-license-cancel");
const beatLicenseModal = document.getElementById("beat-license-modal");
const beatLicenseModalTitle = document.getElementById("beat-license-modal-title");
const beatLicenseModalSubtitle = document.getElementById("beat-license-modal-subtitle");
const beatLicenseModalContent = document.getElementById("beat-license-modal-content");
let beatSearchTimer = 0;
let beatFilterUrlTimer = 0;
let beatLastUrlState = "";
let beatLicenseLastTrigger = null;
let beatCoverObjectUrl = "";
const beatCoverCropState = { x: 0.5, y: 0.5, zoom: 1 };
const beatCoverPointers = new Map();
let beatCoverDragStart = null;
let beatCoverPinchStart = null;

initBeatStore().catch((error) => {
  grid.innerHTML = errorState(error.message || "No se pudo cargar Beat Store.");
});

async function initBeatStore() {
  updateCartCount();
  state.isAdmin = await currentUserIsAdmin();
  const [products, beats, licenses, producerProfiles] = await Promise.all([fetchBeatProducts(state.isAdmin), fetchCloudBeats(), fetchBeatLicenses(state.isAdmin), fetchProducerProfiles(state.isAdmin)]);
  state.products = products;
  state.adminProducts = state.isAdmin ? products : [];
  state.beats = beats;
  state.licenses = licenses;
  state.producerProfiles = producerProfiles;
  state.assignments = await fetchBeatLicenseAssignments(products.map((product) => product.id), state.isAdmin);
  state.items = mergeProductsAndBeats(products, beats);
  buildBeatSearchIndex();
  renderGenreOptions();
  renderProducerOptions();
  applyBeatUrlState();
  renderBeats();
  initializeAdminPanel();

  window.addEventListener("popstate", () => {
    applyBeatUrlState();
    renderBeats();
    if (state.isAdmin) setAdminMode(wantsAdminMode());
  }, { signal: hrBeatStoreLifecycle.signal });

  searchInput?.addEventListener("input", () => {
    window.clearTimeout(beatSearchTimer);
    beatSearchTimer = window.setTimeout(() => {
      renderBeats();
      syncBeatUrlState(true);
    }, 90);
  }, { signal: hrBeatStoreLifecycle.signal });
  [sortSelect, genreSelect, producerSelect].forEach((control) => control?.addEventListener("change", () => {
    renderBeats();
    syncBeatUrlState(true);
  }, { signal: hrBeatStoreLifecycle.signal }));
  [priceMinInput, priceMaxInput, bpmMinInput, bpmMaxInput].forEach((control) => control?.addEventListener("input", () => {
    window.clearTimeout(beatFilterUrlTimer);
    beatFilterUrlTimer = window.setTimeout(() => { renderBeats(); syncBeatUrlState(true); }, 120);
  }, { signal: hrBeatStoreLifecycle.signal }));
  clearFiltersButton?.addEventListener("click", () => {
    clearBeatFilters();
    renderBeats();
    syncBeatUrlState(true);
  }, { signal: hrBeatStoreLifecycle.signal });
  grid?.addEventListener("click", handleGridClick);
  grid?.addEventListener("keydown", handleGridKeydown);
  window.addEventListener("hr:beat-player-state", syncBeatCardPlayState, { signal: hrBeatStoreLifecycle.signal });
  syncBeatCardPlayState({ detail: window.HiddenRoomBeatPlayer || {} });
  adminForm?.addEventListener("submit", handleAdminSubmit);
  adminForm?.addEventListener("change", handleBeatLicenseAssignmentChange);
  adminList?.addEventListener("click", handleAdminListClick);
  beatLicenseForm?.addEventListener("submit", handleBeatLicenseSubmit);
  beatLicenseList?.addEventListener("click", handleBeatLicenseListClick);
  beatLicenseCancel?.addEventListener("click", resetBeatLicenseForm);
  beatLicenseForm?.addEventListener("input", updateBeatLicenseRangeWarning);
  document.getElementById("beat-license-unlimited")?.addEventListener("change", syncBeatLicenseStreamLimitState);
  cancelEditButton?.addEventListener("click", resetAdminForm);
  beatCoverInput?.addEventListener("change", handleBeatCoverSelection);
  beatUploadInput?.addEventListener("change", handleBeatAudioSelection);
  document.getElementById("beat-bpm")?.addEventListener("input", handleManualBeatMetadataInput);
  document.getElementById("beat-key")?.addEventListener("input", handleManualBeatMetadataInput);
  adminForm?.addEventListener("click", handleBeatAutodetectClick);
  beatProducerProfileButton?.addEventListener("click", createOrOpenCurrentProducerProfile);
  beatProducerUsernameButton?.addEventListener("click", useCurrentUsernameAsProducer);
  beatCoverStage?.addEventListener("pointerdown", handleBeatCoverPointerDown);
  beatCoverStage?.addEventListener("pointermove", handleBeatCoverPointerMove);
  beatCoverStage?.addEventListener("pointerup", handleBeatCoverPointerEnd);
  beatCoverStage?.addEventListener("pointercancel", handleBeatCoverPointerEnd);
  beatCoverStage?.addEventListener("lostpointercapture", handleBeatCoverPointerEnd);
  beatCoverStage?.addEventListener("wheel", handleBeatCoverWheel, { passive: false });
  beatCoverStage?.addEventListener("dblclick", resetBeatCoverCrop);
  document.addEventListener("click", handleAdminModeClick, { signal: hrBeatStoreLifecycle.signal });
  beatLicenseModal?.addEventListener("click", handleBeatLicenseModalClick);
  document.addEventListener("keydown", handleBeatLicenseModalKeydown, { signal: hrBeatStoreLifecycle.signal });
}

function ensureAdminMusicFields() {
  if (!adminForm || document.getElementById("beat-genre-input")) return;
  const producerField = document.getElementById("beat-producer")?.closest(".field");
  if (!producerField) return;

  const wrapper = document.createElement("div");
  wrapper.className = "beat-admin__music-fields";
  wrapper.innerHTML = `
    <div class="field hr-field"><label class="hr-label" for="beat-genre-input">GÃ©nero</label><input class="hr-input" id="beat-genre-input" maxlength="80" placeholder="Trap, Boom bap, Reggaeton..."></div>
    <div class="field hr-field beat-autodetect-field"><label class="hr-label" for="beat-bpm">BPM</label><div class="beat-ad-input"><input class="hr-input" id="beat-bpm" type="number" min="1" max="300" step="1"><span class="beat-ad-badge" data-ad-badge="bpm" hidden>AD</span></div><button class="secondary-button beat-autodetect-button" type="button" data-autodetect="bpm">Autodetectar</button></div>
    <div class="field hr-field beat-autodetect-field"><label class="hr-label" for="beat-key">Tonalidad</label><div class="beat-ad-input"><input class="hr-input" id="beat-key" maxlength="24" placeholder="Cm, F# minor..."><span class="beat-ad-badge" data-ad-badge="key" hidden>AD</span></div><button class="secondary-button beat-autodetect-button" type="button" data-autodetect="key">Autodetectar</button></div>
    <input id="beat-duration" type="hidden">
  `;
  producerField.insertAdjacentElement("afterend", wrapper);
}

function adminProductMetaText(product) {
  return [
    product.beat_genre || null,
    product.beat_bpm ? `${product.beat_bpm} BPM${product.beat_bpm_autodetected ? " (AD)" : ""}` : null,
    product.beat_key ? `${product.beat_key}${product.beat_key_autodetected ? " (AD)" : ""}` : null,
    product.beat_duration_seconds ? formatDuration(product.beat_duration_seconds) : null,
  ].filter(Boolean).join(" / ");
}
function wantsAdminMode() {
  const params = new URLSearchParams(window.location.search);
  return params.get("view") === "admin" || params.get("admin") === "1";
}

function setAdminMode(active) {
  const isActive = Boolean(active);
  document.body.classList.toggle("beat-admin-mode", isActive);
  if (adminPanel) adminPanel.hidden = !isActive;
  syncAdminSubNavState(isActive);
}

function syncAdminSubNavState(active) {
  document.querySelectorAll('.hr-nav__sub-link[href="/store/beat_store/"]').forEach((link) => {
    if (active) {
      link.removeAttribute("aria-current");
    } else {
      link.setAttribute("aria-current", "page");
    }
  });
  document.querySelectorAll('.hr-nav__sub-link[href="/store/beat_store/?view=admin"]').forEach((link) => {
    if (active) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  });
}

function ensureAdminEntryLink() {
  if (!state.isAdmin || document.querySelector("[data-beat-admin-entry]")) return;
  const actions = document.querySelector(".beat-hero__actions");
  if (!actions) return;
  const button = document.createElement("button");
  button.className = "secondary-button hr-btn";
  button.type = "button";
  button.dataset.beatAdminEntry = "true";
  button.textContent = "Admin beats";
  actions.appendChild(button);
}

function handleBeatLicenseAssignmentChange(event) {
  const checkbox = event.target.closest("[data-beat-license-check]");
  if (!checkbox) return;
  const input = beatLicenseAssignmentList?.querySelector(`[data-beat-license-price="${CSS.escape(checkbox.dataset.beatLicenseCheck)}"]`);
  if (input) input.disabled = !checkbox.checked;
}
function handleAdminModeClick(event) {
  const adminEntry = event.target.closest("[data-beat-admin-entry]");
  const storeEntry = event.target.closest("[data-beat-store-entry]");
  if (adminEntry) {
    event.preventDefault();
    const url = new URL(window.location.href);
    url.searchParams.set("view", "admin");
    url.hash = "";
    history.pushState(null, "", url);
    setAdminMode(true);
    requestAnimationFrame(() => adminPanel?.scrollIntoView({ behavior: "smooth", block: "start" }));
    return;
  }
  if (storeEntry) {
    event.preventDefault();
    const url = new URL(window.location.href);
    url.searchParams.delete("view");
    url.searchParams.delete("admin");
    url.hash = "";
    history.pushState(null, "", url);
    setAdminMode(false);
    requestAnimationFrame(() => document.getElementById("beat-store-title")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }
}

async function currentUserIsAdmin() {
  const { data: { session } } = await supabase.auth.getSession();
  state.currentUserId = session?.user?.id ?? null;
  if (!session?.user) return false;

  const { data: profile, error } = await supabase
    .from("users")
    .select("roles, username")
    .eq("id", session.user.id)
    .maybeSingle();

  if (error) return false;
  state.currentUsername = String(profile?.username || "").trim();
  syncProducerUsernameButton();
  return String(profile?.roles ?? "")
    .split(",")
    .map((role) => role.trim().toLowerCase())
    .includes("admin");
}

const BEAT_PRODUCT_BASE_SELECT = "id, slug, name, description, category, price, currency, image_url, beat_cover_path, beat_thumb_path, file_url, producer, producer_profile_id, stock, is_digital, featured, is_active, created_at";
const BEAT_PRODUCT_META_SELECT = `${BEAT_PRODUCT_BASE_SELECT}, producer_user_id, beat_genre, beat_bpm, beat_key, beat_duration_seconds`;
const BEAT_PRODUCT_AUTODETECT_SELECT = `${BEAT_PRODUCT_META_SELECT}, beat_bpm_autodetected, beat_key_autodetected`;
const BEAT_PRODUCT_PREVIEW_SELECT = `${state.hasBeatAutodetectFlags ? BEAT_PRODUCT_AUTODETECT_SELECT : BEAT_PRODUCT_META_SELECT}, beat_original_path, beat_preview_path, beat_preview_status, beat_preview_error`;

async function fetchBeatProducts(includeInactive = false) {
  const columns = state.hasBeatPreviews
    ? BEAT_PRODUCT_PREVIEW_SELECT
    : (state.hasBeatMetadata ? BEAT_PRODUCT_META_SELECT : BEAT_PRODUCT_BASE_SELECT);
  const { data, error } = await runBeatProductQuery(includeInactive, columns);

  if (!error) return data ?? [];

  if (state.hasBeatPreviews && isMissingBeatPreviewError(error)) {
    state.hasBeatPreviews = false;
    const fallbackColumns = state.hasBeatMetadata ? (state.hasBeatAutodetectFlags ? BEAT_PRODUCT_AUTODETECT_SELECT : BEAT_PRODUCT_META_SELECT) : BEAT_PRODUCT_BASE_SELECT;
    const fallback = await runBeatProductQuery(includeInactive, fallbackColumns);
    if (!fallback.error) return fallback.data ?? [];
    throw new Error(`No se pudieron cargar productos: ${fallback.error.message}`);
  }

  if (state.haÛNºæÚ$z{-®éÜj×FöâÒWfVçBçF&vWBæ6Æ÷6W7B‚%¶FFÖVF—BÖ&VEÒ"“°¢6öç7BFövvÆT'WGFöâÒWfVçBçF&vWBæ6Æ÷6W7B‚%¶FF×FövvÆRÖ&VEÒ"“°¢6öç7BfVGW&VD'WGFöâÒWfVçBçF&vWBæ6Æ÷6W7B‚%¶FFÖfVGW&RÖ&VEÒ"“°¢6öç7BFVÆWFT'WGFöâÒWfVçBçF&vWBæ6Æ÷6W7B‚%¶FFÖFVÆWFRÖ&VEÒ"“°¢6öç7B&öGV6W%&öf–ÆT'WGFöâÒWfVçBçF&vWBæ6Æ÷6W7B‚%¶FF×&öGV6W"×&öf–ÆRÖ&VEÒ"“° ¢–b†VF—D'WGFöâ’°¢VF—DFÖ–å&öGV7B†VF—D'WGFöâæFF6WBæVF—D&VB“°¢&WGW&ã°¢Ğ¢–b‡FövvÆT'WGFöâ’°¢v—BWFFTFÖ–å&öGV7B‡FövvÆT'WGFöâæFF6WBçFövvÆT&VBÂ²—5ö7F—fS¢FövvÆT'WGFöâæFF6WBæ7F—fRÓÒ'G'VR"Ò“°¢&WGW&ã°¢Ğ¢–b†fVGW&VD'WGFöâ’°¢v—BWFFTFÖ–å&öGV7B†fVGW&VD'WGFöâæFF6WBæfVGW&T&VBÂ²fVGW&VC¢fVGW&VD'WGFöâæFF6WBæfVGW&VBÓÒ'G'VR"Ò“°¢&WGW&ã°¢Ğ¢–b‡&öGV6W%&öf–ÆT'WGFöâ’°¢v—B7&VFT÷$÷Vå&öGV6W%&öf–ÆR‡&öGV6W%&öf–ÆT'WGFöâæFF6WBç&öGV6W%&öf–ÆT&VB“°¢&WGW&ã°¢Ğ¢–b†FVÆWFT'WGFöâbbv–æF÷ræ6öæf—&Ò‚,+ôVÆ–Ö–æ"W7FR&VBFR&öGV7F÷3òFV¦,:FRW†—7F—"&6Æ–VçFW2ÂW&òæò6R&÷'&VÂ&6†—fòFR6Æ÷VBâ"’’°¢6öç7B²W'&÷"ÒÒv—B7W&6Ræg&öÒ‚'7F÷&U÷&öGV7G2"’æFVÆWFR‚’æW‚&–B"ÂFVÆWFT'WGFöâæFF6WBæFVÆWFT&VB“°¢–b†W'&÷"’FÖ–å7FGW2çFW‡D6öçFVçBÒW'&÷"æÖW76vS°¢VÇ6R°¢6†÷tæ÷F–6R‚$&VBVÆ–Ö–æFò"“°¢v—B&VÆöD&VE7F÷&R‚“°¢Ğ¢Ğ§Ğ ¦7–æ2gVæ7F–öâWFFTFÖ–å&öGV7B†–BÂF6‚’°¢6öç7B²W'&÷"ÒÒv—B7W&6Ræg&öÒ‚'7F÷&U÷&öGV7G2"’çWFFR‡F6‚’æW‚&–B"Â–B“°¢–b†W'&÷"’FÖ–å7FGW2çFW‡D6öçFVçBÒW'&÷"æÖW76vS°¢VÇ6Rv—B&VÆöD&VE7F÷&R‚“°§Ğ ¦gVæ7F–öâVF—DFÖ–å&öGV7B†–B’°¢6öç7B&öGV7BÒ7FFRæFÖ–å&öGV7G2æf–æB‚†6æF–FFR’Óâ6æF–FFRæ–BÓÓÒ–B“°¢–b‚&öGV7B’&WGW&ã° ¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&&VB×&öGV7BÖ–B"’çfÇVRÒ&öGV7Bæ–C°¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&&VBÖæÖR"’çfÇVRÒ&öGV7BææÖS°¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&&VB×6ÇVr"’çfÇVRÒ&öGV7Bç6ÇVs°¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&&VBÖFW67&—F–öâ"’çfÇVRÒ&öGV7BæFW67&—F–öâóò"#°¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&&VB×&öGV6W""’çfÇVRÒ&öGV7Bç&öGV6W"óò"#°¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&&VBÖvVç&RÖ–çWB"’çfÇVRÒ&öGV7Bæ&VEövVç&Róò"#°¢6öç7B'Ô–çWBÒFö7VÖVçBævWDVÆVÖVçD'”–B‚&&VBÖ'Ò"“°¢6öç7B¶W”–çWBÒFö7VÖVçBævWDVÆVÖVçD'”–B‚&&VBÖ¶W’"“°¢'Ô–çWBçfÇVRÒ&öGV7Bæ&VEö'Òóò"#°¢'Ô–çWBæFF6WBæWFöFWFV7FVBÒ&öGV7Bæ&VEö'ÕöWFöFWFV7FVBò'G'VR"¢&fÇ6R#°¢¶W”–çWBçfÇVRÒ&öGV7Bæ&VEö¶W’óò"#°¢¶W”–çWBæFF6WBæWFöFWFV7FVBÒ&öGV7Bæ&VEö¶W•öWFöFWFV7FVBò'G'VR"¢&fÇ6R#°¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&&VBÖGW&F–öâ"’çfÇVRÒ&öGV7Bæ&VEöGW&F–öå÷6V6öæG2óò"#°¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&&VBÖ–ÖvR×W&Â"’çfÇVRÒ&öGV7Bæ–ÖvU÷W&Âóò"#°¢–b†&VD6÷fW$VF—F÷"’&VD6÷fW$VF—F÷"æ†–FFVâÒG'VS°¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&&VBÖf–ÆR×W&Â"’çfÇVRÒ&öGV7Bæf–ÆU÷W&Âóò"#°¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&&VB×7Fö6²"’çfÇVRÒ&öGV7Bç7Fö6²óò"#°¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&&VBÖfVGW&VB"’æ6†V6¶VBÒ&ööÆVâ‡&öGV7BæfVGW&VB“°¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&&VBÖ7F—fR"’æ6†V6¶VBÒ&ööÆVâ‡&öGV7Bæ—5ö7F—fR“°¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&&VBÖF–v—FÂ"’æ6†V6¶VBÒ&ööÆVâ‡&öGV7Bæ—5öF–v—FÂ“°¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&&VBÖf÷&Ò×F—FÆR"’çFW‡D6öçFVçBÒ$VF—F"&VB#°¢6æ6VÄVF—D'WGFöâæ†–FFVâÒfÇ6S°¢&VæFW$&VDÆ–6Vç6T76–væÖVçDf–VÆG2‚“°¢7–æ5&öGV6W%&öf–ÆT'WGFöâ‡&öGV7B“°¢FÖ–äf÷&Òç67&öÆÄ–çFõf–Wr‡²&V†f–÷#¢'6Öö÷F‚"Â&Æö6³¢'7F'B"Ò“°§Ğ ¦gVæ7F–öâ&W6WDFÖ–äf÷&Ò‚’°¢–b‚FÖ–äf÷&Ò’&WGW&ã°¢FÖ–äf÷&Òç&W6WB‚“°¢–b†&VD6÷fW$VF—F÷"’&VD6÷fW$VF—F÷"æ†–FFVâÒG'VS°¢–b†&VD6÷fW$ö&¦V7EW&Â’U$Âç&Wfö¶Tö&¦V7EU$Â†&VD6÷fW$ö&¦V7EW&Â“°¢&VD6÷fW$ö&¦V7EW&ÂÒ"#°¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&&VB×&öGV7BÖ–B"’çfÇVRÒ"#°¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&&VBÖ7F—fR"’æ6†V6¶VBÒG'VS°¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&&VBÖF–v—FÂ"’æ6†V6¶VBÒG'VS°¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&&VBÖf÷&Ò×F—FÆR"’çFW‡D6öçFVçBÒ$çVWfò&VB#°¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&&VBÖ'Ò"’æFF6WBæWFöFWFV7FVBÒ&fÇ6R#°¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&&VBÖ¶W’"’æFF6WBæWFöFWFV7FVBÒ&fÇ6R#°¢6æ6VÄVF—D'WGFöâæ†–FFVâÒG'VS°¢FÖ–äW'&÷"çFW‡D6öçFVçBÒ"#°¢&VæFW$&VDÆ–6Vç6T76–væÖVçDf–VÆG2‚“°¢7–æ5&öGV6W%&öf–ÆT'WGFöâ†çVÆÂ“°§Ğ ¦7–æ2gVæ7F–öâ&VÆöD&VE7F÷&R†÷F–öç2Ò·Ò’°¢–b†÷F–öç2ç&Vg&W6„&VG2’7FFRæ&VG2Òv—BfWF6„6Æ÷VD&VG2‚“°¢6öç7B&öGV7G2Òv—BfWF6„&VE&öGV7G2‡7FFRæ—4FÖ–â“°¢7FFRç&öGV7G2Ò&öGV7G3°¢7FFRæFÖ–å&öGV7G2Ò7FFRæ—4FÖ–âò&öGV7G2¢µÓ°¢7FFRæÆ–6Vç6W2Òv—BfWF6„&VDÆ–6Vç6W2‡7FFRæ—4FÖ–â“°¢7FFRç&öGV6W%&öf–ÆW2Òv—BfWF6…&öGV6W%&öf–ÆW2‡7FFRæ—4FÖ–â“°¢7FFRæ76–væÖVçG2Òv—BfWF6„&VDÆ–6Vç6T76–væÖVçG2‡&öGV7G2æÖ‚‡&öGV7B’Óâ&öGV7Bæ–B’Â7FFRæ—4FÖ–â“°¢7FFRæ—FV×2ÒÖW&vU&öGV7G4æD&VG2‡&öGV7G2Â7FFRæ&VG2“°Ğ¢'V–ÆD&VE6V&6„–æFW‚‚“°¢&VæFW$vVç&T÷F–öç2‚“°¢&VæFW$&VG2‚“°¢&VæFW$FÖ–å&öGV7G2‚“°¢&VæFW$&VDÆ–6Vç6TFÖ–â‚“°¢&VæFW$&VDÆ–6Vç6T76–væÖVçDf–VÆG2‚“°¢7–æ5&öGV6W%&öf–ÆT'WGFöâ‚“°§Ğ ¦gVæ7F–öâvWD6'B‚’°¢G'’°¢6öç7B7F÷&VBÒ¥4ôâç'6R†Æö6Å7F÷&vRævWD—FVÒ„4%Eõ5Dõ$tUô´U’’ÇÂ%µÒ"“°¢–b‚'&’æ—4'&’‡7F÷&VB’’&WGW&âµÓ°¢&WGW&â7F÷&V@¢æÖ‚†—FVÒ’Óâ‡²–C¢7G&–ær†—FVÓòæ–BÇÂ""’ÂVçF—G“¢ÖF‚æÖ‚ƒÂÖF‚æÖ–âƒÂçVÖ&W"ç'6T–çB†—FVÓòçVçF—G’Â’ÇÂ’’Ò’¢æf–ÇFW"‚†—FVÒ’Óâ—FVÒæ–B“°¢Ò6F6‚°¢&WGW&âµÓ°¢Ğ§Ğ ¦gVæ7F–öâ6fT6'B†6'B’°¢Æö6Å7F÷&vRç6WD—FVÒ„4%Eõ5Dõ$tUô´U’Â¥4ôâç7G&–æv–g’†6'B’“°¢WFFT6'D6÷VçB‚“°§Ğ ¦gVæ7F–öâWFFT6'D6÷VçB‚’°¢6öç7B6÷VçBÒvWD6'B‚’ç&VGV6R‚‡F÷FÂÂ—FVÒ’ÓâF÷FÂ²—FVÒçVçF—G’Â“°¢Fö7VÖVçBçVW'•6VÆV7F÷$ÆÂ‚"æ6'BÖ6÷VçB"’æf÷$V6‚‚†VÆVÖVçB’Óâ°¢VÆVÖVçBçFW‡D6öçFVçBÒ7G&–ær†6÷VçB“°¢Ò“°§Ğ ¦gVæ7F–öâ6Æ÷VDf–ÆTæÖR‡fÇVR’°¢6öç7B6ÆVâÒ7G&–ær‡fÇVRÇÂ""’ç7Æ—B‚#ò"•³Òç7Æ—B‚"2"•³Ó°¢G'’°¢&WGW&âFV6öFUU$”6ö×öæVçB†6ÆVâç7Æ—B‚"ò"’æf–ÇFW"„&ööÆVâ’ç÷‚’ÇÂ6ÆVâ“°¢Ò6F6‚°¢&WGW&â6ÆVâç7Æ—B‚"ò"’æf–ÇFW"„&ööÆVâ’ç÷‚’ÇÂ6ÆVã°¢Ğ§Ğ ¦gVæ7F–öâ—FVÕF—FÆR†—FVÒ’°¢&WGW&â—FVÒç&öGV7CòææÖRÇÂ—FVÒæ&VCòçF—FÆRÇÂ$&VB#°§Ğ ¦gVæ7F–öâ7–æ5&öGV6W%W6W&æÖT'WGFöâ‚’°¢–b‚&VE&öGV6W%W6W&æÖT'WGFöâ’&WGW&ã°¢&VE&öGV6W%W6W&æÖT'WGFöâæ†–FFVâÒ7FFRæ7W'&VçEW6W&æÖS°¢&VE&öGV6W%W6W&æÖT'WGFöâçFW‡D6öçFVçBÒ7FFRæ7W'&VçEW6W&æÖRòW6"G·7FFRæ7W'&VçEW6W&æÖWÖ¢%W6"Ö’W6W&æÖR#°¢&VE&öGV6W%W6W&æÖT'WGFöâçF—FÆRÒ7FFRæ7W'&VçEW6W&æÖRòW6"G·7FFRæ7W'&VçEW6W&æÖWÒ6öÖò&öGV7F÷&¢$æò†’W6W&æÖRF—7öæ–&ÆRVâGRW7V&–òâ#°§Ğ ¦gVæ7F–öâW6T7W'&VçEW6W&æÖT5&öGV6W"‚’°¢6öç7B–çWBÒFö7VÖVçBævWDVÆVÖVçD'”–B‚&&VB×&öGV6W""“°¢–b‚–çWBÇÂ7FFRæ7W'&VçEW6W&æÖR’&WGW&ã°¢–çWBçfÇVRÒ&öGV6W%7F÷&vTæÖR‡7FFRæ7W'&VçEW6W&æÖR“°¢–çWBæfö7W2‚“°§Ğ¦gVæ7F–öâ7W'&VçDVF—F–æu&öGV7B‚’°¢6öç7B&öGV7D–BÒFö7VÖVçBævWDVÆVÖVçD'”–B‚&&VB×&öGV7BÖ–B"“òçfÇVRÇÂ"#°¢&WGW&â7FFRæFÖ–å&öGV7G2æf–æB‚†6æF–FFR’Óâ6æF–FFRæ–BÓÓÒ&öGV7D–B’ÇÂçVÆÃ°§Ğ ¦gVæ7F–öâ7–æ5&öGV6W%&öf–ÆT'WGFöâ‡&öGV7BÒ7W'&VçDVF—F–æu&öGV7B‚’’°¢7–æ5&öGV6W%W6W&æÖT'WGFöâ‚“°¢–b‚&VE&öGV6W%&öf–ÆT'WGFöâ’&WGW&ã°¢&VE&öGV6W%&öf–ÆT'WGFöâæ†–FFVâÒ7FFRæ—4FÖ–ã°¢6öç7B&öf–ÆRÒ&öGV6W%&öf–ÆTf÷%&öGV7B‡&öGV7B“°¢&VE&öGV6W%&öf–ÆT'WGFöâçFW‡D6öçFVçBÒ&öf–ÆRò%fW"W&f–Â"¢$7&V"W&f–Â#°¢&VE&öGV6W%&öf–ÆT'WGFöâæF—6&ÆVBÒ&öGV7C°¢&VE&öGV6W%&öf–ÆT'WGFöâçF—FÆRÒ&öGV7@¢ò‡&öf–ÆRò$'&—"6L:ÆövòFVÂ&öGV7F÷""¢$7&V"6L:ÆövòFVÂ&öGV7F÷""¢¢$wV&FVÂ&VB&–ÖW&ò&7&V"VÂW&f–Ââ#°§Ğ ¦7–æ2gVæ7F–öâ7&VFT÷$÷Vä7W'&VçE&öGV6W%&öf–ÆR‚’°¢6öç7B&öGV7BÒ7W'&VçDVF—F–æu&öGV7B‚“°¢–b‚&öGV7B’°¢–b†FÖ–å7FGW2’FÖ–å7FGW2çFW‡D6öçFVçBÒ$wV&FVÂ&VB&–ÖW&ò&7&V"’f–æ7VÆ"VÂW&f–ÂFVÂ&öGV7F÷"â#°¢7–æ5&öGV6W%&öf–ÆT'WGFöâ†çVÆÂ“°¢&WGW&ã°¢Ğ¢v—B7&VFT÷$÷Vå&öGV6W%&öf–ÆR‡&öGV7Bæ–B“°§Ğ¦gVæ7F–öâ&öGV6W%&öf–ÆTf÷%&öGV7B‡&öGV7BÒ·Ò’°¢–b‚&öGV7B’&WGW&âçVÆÃ°¢&WGW&â7FFRç&öGV6W%&öf–ÆW2æf–æB‚‡&öf–ÆR’Óâ&öf–ÆRæ–BÓÓÒ&öGV7Bç&öGV6W%÷&öf–ÆUö–B¢ÇÂ7FFRç&öGV6W%&öf–ÆW2æf–æB‚‡&öf–ÆR’Óâ&öf–ÆRç6ÇVrÓÓÒæ÷&ÖÆ—¦T¶W’‡&öGV7Bç&öGV6W"ÇÂ""’¢ÇÂçVÆÃ°§Ğ ¦gVæ7F–öâ&öGV6W$Æ–æ´Ö&·W†—FVÒÂfÆÆ&6´æÖRÒ""’°¢6öç7B&öGV7BÒ—FVÓòç&öGV7BÇÂ·Ó°¢6öç7B&öf–ÆRÒ&öGV6W%&öf–ÆTf÷%&öGV7B‡&öGV7B“°¢6öç7BæÖRÒ&öGV6W$F—7Æ”æÖR‡&öf–ÆSòæF—7Æ•öæÖRÇÂfÆÆ&6´æÖRÇÂ%&öGV7F÷"÷"6öæf—&Ö""“°¢–b‚&öf–ÆSòç6ÇVrÇÂ&öf–ÆRæ—5ö7F—fRÓÓÒfÇ6R’&WGW&âW66T‡FÖÂ†æÖR“°¢&WGW&âÆ‡&VcÒ'&öGV6W"æ‡FÖÃ÷&öGV6W#ÒG¶Væ6öFUU$”6ö×öæVçB‡&öf–ÆRç6ÇVr—Ò#âG¶W66T‡FÖÂ†æÖR—ÓÂöæ°§Ğ ¦7–æ2gVæ7F–öâ7&VFT÷$÷Vå&öGV6W%&öf–ÆR‡&öGV7D–B’°¢6öç7B&öGV7BÒ7FFRæFÖ–å&öGV7G2æf–æB‚†6æF–FFR’Óâ6æF–FFRæ–BÓÓÒ&öGV7D–B“°¢–b‚&öGV7B’&WGW&ã°¢6öç7BW†—7F–ærÒ&öGV6W%&öf–ÆTf÷%&öGV7B‡&öGV7B“°¢–b†W†—7F–æsòç6ÇVr’°¢v—BÆ–æ´ÖF6†–æu&öGV6W%&öGV7G2†W†—7F–æræ–BÂ&öGV7B“°¢v–æF÷ræ÷Vâ†&öGV6W"æ‡FÖÃ÷&öGV6W#ÒG¶Væ6öFUU$”6ö×öæVçB†W†—7F–ærç6ÇVr—ÖÂ%ö&Ææ²"Â&æö÷VæW""“°¢&WGW&ã°¢Ğ¢6öç7BF—7Æ”æÖRÒ&öGV6W%7F÷&vTæÖR‡&öGV7Bç&öGV6W"ÇÂ&öGV7BææÖRÇÂ%&öGV7F÷""“°¢6öç7B6ÇVrÒVæ—VU&öGV6W%6ÇVr†F—7Æ”æÖR“°¢6öç7B–ÆöBÒ°¢6ÇVrÀ¢F—7Æ•öæÖS¢F—7Æ”æÖRÀ¢W6W%ö–C¢&öGV7Bç&öGV6W%÷W6W%ö–BÇÂ7FFRæ7W'&VçEW6W$–BÇÂçVÆÂÀ¢—5ö7F—fS¢G'VRÀ¢Ó°¢6öç7B²FFÂW'&÷"ÒÒv—B7W&6Ræg&öÒ‚'&öGV6W%÷&öf–ÆW2"’æ–ç6W'B‡–ÆöB’ç6VÆV7B‚&–BÂ6ÇVrÂF—7Æ•öæÖRÂ—5ö7F—fR"’ç6–ævÆR‚“°¢–b†W'&÷"’°¢FÖ–å7FGW2çFW‡D6öçFVçBÒW'&÷"æÖW76vS°¢&WGW&ã°¢Ğ¢6öç7BÆ–æ¶VD&VD–G2Òv—BÆ–æ´ÖF6†–æu&öGV6W%&öGV7G2†FFæ–BÂ&öGV7B“°¢6†÷tæ÷F–6R†W&f–ÂFR&öGV7F÷"7&VFò’f–æ7VÆFòG¶Æ–æ¶VD&VD–G2æÆVæwF‡Ò&VBG¶Æ–æ¶VD&VD–G2æÆVæwF‚ÓÓÒò""¢'2'Ö“°¢v–æF÷ræ÷Vâ†&öGV6W"æ‡FÖÃ÷&öGV6W#ÒG¶Væ6öFUU$”6ö×öæVçB†FFç6ÇVr—ÖÂ%ö&Ææ²"Â&æö÷VæW""“°§Ğ ¦7–æ2gVæ7F–öâÆ–æ´ÖF6†–æu&öGV6W%&öGV7G2‡&öf–ÆT–BÂ&öGV7BÒ·Ò’°¢6öç7BÆ–æ¶VD&VD–G2ÒÖF6†–æu&öGV6W%&öGV7D–G2‡&öGV7B“°¢6öç7B²W'&÷"ÒÒv—B7W&6Ræg&öÒ‚'7F÷&U÷&öGV7G2"’çWFFR‡²&öGV6W%÷&öf–ÆUö–C¢&öf–ÆT–BÒ’æ–â‚&–B"ÂÆ–æ¶VD&VD–G2“°¢–b†W'&÷"’°¢–b†FÖ–å7FGW2’FÖ–å7FGW2çFW‡D6öçFVçBÒW'&÷"æÖW76vS°¢F‡&÷ræWrW'&÷"†W'&÷"æÖW76vR“°¢Ğ¢v—B&VÆöD&VE7F÷&R‚“°¢&WGW&âÆ–æ¶VD&VD–G3°§Ğ ¦gVæ7F–öâÖF6†–æu&öGV6W%&öGV7D–G2‡&öGV7BÒ·Ò’°¢6öç7B&öGV6W$¶W’Òæ÷&ÖÆ—¦T¶W’‡&öGV7Bç&öGV6W"ÇÂ""“°¢6öç7BÖF6†W2Ò7FFRæFÖ–å&öGV7G0¢æf–ÇFW"‚†6æF–FFR’Óâ6æF–FFSòæ6FVv÷'’ÓÓÒ&&VG2"¢æf–ÇFW"‚†6æF–FFR’Óâæ÷&ÖÆ—¦T¶W’†6æF–FFRç&öGV6W"ÇÂ""’ÓÓÒ&öGV6W$¶W’¢æÖ‚†6æF–FFR’Óâ6æF–FFRæ–B¢æf–ÇFW"„&ööÆVâ“°¢–b‚ÖF6†W2æ–æ6ÇVFW2‡&öGV7Bæ–B’’ÖF6†W2çW6‚‡&öGV7Bæ–B“°¢&WGW&â²ââææWr6WB†ÖF6†W2•Ó°§Ğ¦gVæ7F–öâ&öGV6W%7F÷&vTæÖR‡fÇVR’°¢&WGW&â7G&–ær‡fÇVRÇÂ""’çG&–Ò‚’ç&WÆ6R‚õä²òÂ""“°§Ğ ¦gVæ7F–öâ&öGV6W$F—7Æ”æÖR‡fÇVR’°¢6öç7B6ÆVâÒ&öGV6W%7F÷&vTæÖR‡fÇVR“°¢–b‚6ÆVâÇÂ6ÆVâÓÓÒ%&öGV7F÷"÷"6öæf—&Ö""’&WGW&â6ÆVâÇÂ%&öGV7F÷"÷"6öæf—&Ö"#°¢&WGW&âG¶6ÆVçÖ°§Ğ¦gVæ7F–öâVæ—VU&öGV6W%6ÇVr†æÖR’°¢6öç7B&6RÒæ÷&ÖÆ—¦T¶W’†æÖR’ÇÂ'&öGV7F÷"#°¢6öç7BW6VBÒæWr6WB‡7FFRç&öGV6W%&öf–ÆW2æÖ‚‡&öf–ÆR’Óâ&öf–ÆRç6ÇVr’“°¢–b‚W6VBæ†2†&6R’’&WGW&â&6S°¢ÆWB–æFW‚Ò#°¢v†–ÆR‡W6VBæ†2†G¶&6WÒÒG¶–æFW‡Ö’’–æFW‚³Ò°¢&WGW&âG¶&6WÒÒG¶–æFW‡Ö°§Ğ¦gVæ7F–öâ&öGV7E&öGV6W"†—FVÒ’°¢&WGW&â—FVÒç&öGV7Còç&öGV6W"ÇÂ—FVÒæ&VCòç&öGV6W"ÇÂ"#°§Ğ ¦gVæ7F–öâ&VDvVç&R†—FVÒ’°¢&WGW&â—FVÓòç&öGV7Còæ&VEövVç&RÇÂ—FVÓòæ&VCòævVç&RÇÂ—FVÓòç&öGV7Còæ6FVv÷'’ÇÂ"#°§Ğ ¦gVæ7F–öâ—FVÔ×W6–4ÖWF†—FVÒ’°¢6öç7B&öGV7BÒ—FVÓòç&öGV7BÇÂ·Ó°¢6öç7B&VBÒ—FVÓòæ&VBÇÂ·Ó°¢6öç7B'ÒÒ&öGV7Bæ&VEö'ÒÇÂ&VBæ'Ó°¢6öç7B¶W’Ò&öGV7Bæ&VEö¶W’ÇÂ&VBæ¶W“°¢6öç7BvVç&RÒ&öGV7Bæ&VEövVç&RÇÂ&VBævVç&S°¢6öç7BGW&F–öâÒ&öGV7Bæ&VEöGW&F–öå÷6V6öæG2ÇÂ&VBæGW&F–öå÷6V6öæG2ÇÂ&VBæGW&F–öã°¢6öç7B'ÕFW‡BÒ'ÒòG¶'×ÒG·&öGV7Bæ&VEö'ÕöWFöFWFV7FVBò"„B’"¢"'Ö¢"#°¢6öç7B¶W•FW‡BÒ¶W’òG¶¶W—ÒG·&öGV7Bæ&VEö¶W•öWFöFWFV7FVBò"„B’"¢"'Ö¢"#°¢&WGW&â°¢vVç&Rò²Æ&VÃ¢$|:–æW&ò"ÂfÇVS¢vVç&RÒ¢çVÆÂÀ¢'ÕFW‡Bò²Æ&VÃ¢$%Ò"ÂfÇVS¢'ÕFW‡BÒ¢çVÆÂÀ¢¶W•FW‡Bò²Æ&VÃ¢%FöæÆ–FB"ÂfÇVS¢¶W•FW‡BÒ¢çVÆÂÀ¢GW&F–öâò²Æ&VÃ¢$GW&6œ;6â"ÂfÇVS¢f÷&ÖDGW&F–öâ†GW&F–öâ’Ò¢çVÆÂÀ¢Òæf–ÇFW"„&ööÆVâ“°§Ğ ¦gVæ7F–öâf÷&ÖDGW&F–öâ‡fÇVR’°¢6öç7B6V6öæG2ÒçVÖ&W"‡fÇVR“°¢–b‚çVÖ&W"æ—4f–æ—FR‡6V6öæG2’ÇÂ6V6öæG2ÃÒ’&WGW&â7G&–ær‡fÇVRÇÂ""“°¢6öç7BÖ–çWFW2ÒÖF‚æfÆö÷"‡6V6öæG2òc“°¢6öç7B&W7BÒÖF‚æfÆö÷"‡6V6öæG2Rc“°¢&WGW&âG¶Ö–çWFW7Ó¢Gµ7G&–ær‡&W7B’çE7F'Bƒ"Â#"—Ö°§Ğ ¦gVæ7F–öâçVÆÆ&ÆTçVÖ&W$g&öÔ–çWB†–B’°¢6öç7BfÇVRÒFö7VÖVçBævWDVÆVÖVçD'”–B†–B“òçfÇVS°¢&WGW&âfÇVRÓÓÒ""òçVÆÂ¢çVÖ&W"‡fÇVR“°§Ğ ¦gVæ7F–öâ&öGV7D6ä&UW&6†6VB‡&öGV7B’°¢–b‡&öGV7Bæ—5ö7F—fRÓÓÒfÇ6R’&WGW&âfÇ6S°¢&WGW&â&öGV7Bç7Fö6²ÓÓÒçVÆÂÇÂçVÖ&W"‡&öGV7Bç7Fö6²’â°§Ğ ¦gVæ7F–öâ6FVv÷'”Æ&VÂ†6FVv÷'’’°¢&WGW&â²&VG3¢$&VG2"ÂÖW&6ƒ¢$ÖW&6‚"ÂF–v—FÃ¢$F–v—FÂ"ÂWfVçF÷3¢$WfVçF÷2"Õ¶6FVv÷'•ÒÇÂ6FVv÷'“°§Ğ ¦gVæ7F–öâæ÷&ÖÆ—¦T¶W’‡fÇVR’°¢&WGW&â7G&–ær‡fÇVRÇÂ""¢ææ÷&ÖÆ—¦R‚$äd´B"¢ç&WÆ6R‚õµÇS3ÕÇS3feÒörÂ""¢çFôÆ÷vW$66R‚¢ç&WÆ6R‚õµæ×£Ó•Ò²örÂ"Ò"¢ç&WÆ6R‚õâÒ·ÂÒ²BörÂ""“°§Ğ ¦gVæ7F–öâ7G&VÔÆ–Ö—DÆ&VÂ†Æ–6Vç6R’°¢–b‚Æ–6Vç6R’&WGW&â%÷"6öæf—&Ö"#°¢–b†Æ–6Vç6RçVæÆ–Ö—FVE÷7G&V×2’&WGW&â$–Æ–Ö—FF÷2#°¢6öç7BÆ–Ö—BÒçVÖ&W"†Æ–6Vç6Rç7G&VÕöÆ–Ö—B“°¢–b‚çVÖ&W"æ—4f–æ—FR†Æ–Ö—B’’&WGW&â%÷"6öæf—&Ö"#°¢&WGW&âG¶æWr–çFÂäçVÖ&W$f÷&ÖB‚&W2ÔÕ‚"’æf÷&ÖB†Æ–Ö—B—Ò7G&V×6°§Ğ ¦gVæ7F–öâ&–6Uv—F†–äÆ–6Vç6U&ævR‡&–6RÂÆ–6Vç6R’°¢6öç7BfÇVRÒçVÖ&W"‡&–6R“°¢&WGW&âçVÖ&W"æ—4f–æ—FR‡fÇVR’bbfÇVRãÒçVÖ&W"†Æ–6Vç6RæÖ–å÷&–6R’bbfÇVRÃÒçVÖ&W"†Æ–6Vç6RæÖ…÷&–6R“°§Ğ¦gVæ7F–öâf÷&ÖE&–6R†Ö÷VçBÂ7W'&Væ7’Ò$Õ„â"’°¢&WGW&âæWr–çFÂäçVÖ&W$f÷&ÖB‚&W2ÔÕ‚"Â²7G–ÆS¢&7W'&Væ7’"Â7W'&Væ7“¢7W'&Væ7’ÇÂ$Õ„â"Ò’æf÷&ÖB„çVÖ&W"†Ö÷VçB’“°§Ğ ¦gVæ7F–öâW'&÷%7FFR†ÖW76vR’°¢&WGW&âÆF—b6Æ73Ò&V×G’×7FFR‡"ÖV×G’×7FFR&VBÖV×G’#ãÆƒ#äæòVF–Ö÷26&v"&VB7F÷&SÂöƒ#ãÇâG¶W66T‡FÖÂ†ÖW76vR—ÓÂ÷ãÂöF—cæ°§Ğ ¦gVæ7F–öâ6†÷tæ÷F–6R†ÖW76vR’°¢6öç7Bæ÷F–6RÒFö7VÖVçBævWDVÆVÖVçD'”–B‚'7F÷&RÖæ÷F–6R"“°¢–b‚æ÷F–6R’&WGW&ã°¢VÆWfFU7F÷&Tæ÷F–6R†æ÷F–6R“°¢æ÷F–6Ræ6Æ74æÖRÒ&æ÷F–6R‡"×Fö7B‡"×Fö7BÒ×7V66W72f—6–&ÆR‡"×Fö7BÒ×f—6–&ÆR#°¢æ÷F–6Ræ–ææW$…DÔÂÒsÇ7â6Æ73Ò&‡"×Fö7EõöF÷B"&–Ö†–FFVãÒ'G'VR#ãÂ÷7ããÇ7â6Æ73Ò&‡"×Fö7EõöÖW76vR#ãÂ÷7ãâs°¢æ÷F–6RçVW'•6VÆV7F÷"‚"æ‡"×Fö7EõöÖW76vR"’çFW‡D6öçFVçBÒÖW76vS°¢v–æF÷ræ6ÆV%F–ÖV÷WB‡6†÷tæ÷F–6RçF–ÖV÷WB“°¢6†÷tæ÷F–6RçF–ÖV÷WBÒv–æF÷rç6WEF–ÖV÷WB‚‚’Óâ°¢æ÷F–6Ræ6Æ74Æ—7Bç&VÖ÷fR‚'f—6–&ÆR"Â&‡"×Fö7BÒ×f—6–&ÆR"“°¢ÒÂ##“°§Ğ ¦gVæ7F–öâVÆWfFU7F÷&Tæ÷F–6R†æ÷F–6R’°¢Fö7VÖVçBæ&öG’æVæB†æ÷F–6R“°¢ö&¦V7Bæ76–vâ†æ÷F–6Rç7G–ÆRÂ°¢÷6—F–öã¢&f—†VB"À¢&–v‡C¢&Ö‚ƒg‚ÂVçb‡6fRÖ&VÖ–ç6WB×&–v‡B’’"À¢&÷GFöÓ¢&6Æ2‡f"‚ÒÖ‡"Ö&VB×Æ–W"Ööfg6WBÂ‚’²Ö‚ƒg‚ÂVçb‡6fRÖ&VÖ–ç6WBÖ&÷GFöÒ’’’"À¢¤–æFWƒ¢##CsCƒ3cCr"À¢F—7Æ“¢&w&–B"À¢ö–çFW$WfVçG3¢&WFò"À¢Ò“°§Ğ ¦gVæ7F–öâW66T‡FÖÂ‡fÇVR’°¢&WGW&â7G&–ær‡fÇVRóò""¢ç&WÆ6TÆÂ‚"b"Â"f×²"¢ç&WÆ6TÆÂ‚#Â"Â"fÇC²"¢ç&WÆ6TÆÂ‚#â"Â"fwC²"¢ç&WÆ6TÆÂ‚r"rÂ"gV÷C²"¢ç&WÆ6TÆÂ‚"r"Â"b33“²"“°§Ğ