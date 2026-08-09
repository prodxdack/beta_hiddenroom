export async function mount({ root = document } = {}) {
  const lifecycle = new AbortController();
  let mounted = true;
  const signal = lifecycle.signal;
  const query = (selector) => root.querySelector(selector);
  const sessionUser = query("#session-user");
  const pageMessage = query("#page-message");
  const actions = query("#ticket-home-actions");
  const teardown = () => { mounted = false; lifecycle.abort(); };
  if (!new URL(import.meta.url).searchParams.has("hr_spa")) window.HiddenRoomApp?.register(teardown);
  const setMessage = (message, type = "") => {
    if (!mounted || signal.aborted || !pageMessage) return;
    pageMessage.textContent = message;
    pageMessage.className = `ticket-alert hr-card${type ? ` ticket-alert--${type}` : ""}`;
    pageMessage.hidden = false;
  };

  try {
    const supabase = await window.HiddenRoomSupabase.getClient();
    if (!mounted || signal.aborted) return teardown;
    const { data: { user }, error } = await supabase.auth.getUser();
    if (!mounted || signal.aborted) return teardown;
    if (error || !user) {
      sessionStorage.setItem("hr_return_after_login", "/tickets/");
      window.location.replace("/portal/");
      return teardown;
    }

    if (sessionUser) sessionUser.textContent = user.email || user.id;
    const { error: profileError } = await supabase.from("users").select("roles").eq("id", user.id).maybeSingle();
    if (profileError) {
      console.error("[Tickets] No fue posible consultar el perfil:", profileError);
      setMessage("No fue posible verificar todos los accesos de tu cuenta.", "error");
    }
    if (mounted && !signal.aborted && actions) actions.hidden = false;
  } catch (error) {
    setMessage(error?.message || "No se pudo cargar la boletera.", "error");
  }

  return teardown;
}

if (!new URL(import.meta.url).searchParams.has("hr_spa")) mount({ root: document.getElementById("hr-spa-content") || document });
