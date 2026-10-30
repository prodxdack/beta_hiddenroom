const BEAT_STORE_INVITE_TYPE = "beat-store-invite";
const supabase = await window.HiddenRoomSupabase.getClient();
const lifecycle = new AbortController();

window.HiddenRoomApp?.register(() => {
  lifecycle.abort();
  closeInviteModal();
});

initProducerInvite().catch(() => {});

async function initProducerInvite() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return;

  const { data: profile } = await supabase
    .from("users")
    .select("username,roles")
    .eq("id", session.user.id)
    .maybeSingle();

  if (isAdmin(profile?.roles)) return;

  const { data: notification, error } = await supabase
    .from("notifications")
    .select("id")
    .eq("user_id", session.user.id)
    .eq("type", BEAT_STORE_INVITE_TYPE)
    .eq("read", false)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !notification?.id) return;
  showInviteModal(notification.id, profile?.username);
}

function isAdmin(rawRoles) {
  return String(rawRoles || "")
    .split(",")
    .map((role) => role.trim().toLowerCase())
    .includes("admin");
}

function showInviteModal(notificationId, rawUsername) {
  closeInviteModal();

  const overlay = document.createElement("div");
  overlay.id = "hr-beat-store-invite-modal";
  overlay.className = "beat-store-invite-modal";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-labelledby", "beat-store-invite-title");
  overlay.innerHTML = `
    <div class="beat-store-invite-modal__backdrop" data-beat-store-invite-close></div>
    <section class="beat-store-invite-modal__dialog hr-panel">
      <p class="beat-store-invite-modal__eyebrow">Beat Store · Hidden Room</p>
      <h2 id="beat-store-invite-title">¡BIENVENIDO A BEAT STORE, <span data-beat-store-invite-username></span>!</h2>
      <div class="beat-store-invite-modal__copy">
        <p>Esperamos que nuestra plataforma te sea de gran ayuda para generar ingresos y dar a conocer tus beats. Si tienes quejas o sugerencias no dudes en contactarnos por Whats App o con tu PR.</p>
        <p>- Equipo de Hidden Room</p>
        <p class="beat-store-invite-modal__legal">Al hacer uso de nuestra plataforma, confirmas que aceptas los términos y condiciones de uso y política de privacidad.</p>
      </div>
      <button class="primary-button beat-store-invite-modal__button" type="button" data-beat-store-invite-close>Aceptar</button>
    </section>
  `;

  const username = String(rawUsername || "PRODUCTOR").trim().replace(/^@+/, "") || "PRODUCTOR";
  overlay.querySelector("[data-beat-store-invite-username]").textContent = `@${username}`;
  document.body.appendChild(overlay);
  document.body.classList.add("hr-overlay-open");

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay || event.target.closest("[data-beat-store-invite-close]")) {
      void dismissInviteModal(notificationId);
    }
  }, { signal: lifecycle.signal });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && document.getElementById("hr-beat-store-invite-modal")) {
      void dismissInviteModal(notificationId);
    }
  }, { signal: lifecycle.signal });
  window.requestAnimationFrame(() => overlay.querySelector("[data-beat-store-invite-close].beat-store-invite-modal__button")?.focus());
}

async function dismissInviteModal(notificationId) {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user && notificationId) {
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("id", notificationId)
      .eq("user_id", session.user.id);
  }
  closeInviteModal();
}

function closeInviteModal() {
  document.getElementById("hr-beat-store-invite-modal")?.remove();
  document.body.classList.remove("hr-overlay-open");
}
