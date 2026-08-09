const PROVIDER_STORAGE_KEY = "kairen_ai_provider";
const MODEL_STORAGE_KEY = "kairen_ai_model";
const DEFAULT_PROVIDER = "gemini";
const DEFAULT_MODEL = "gemini-3.1-flash-lite";
const KAIREN_PERMISSION = "Kairen AI";

const MODEL_GROUPS = [
  { label: "Chat", models: [["gemini-3.1-flash-lite", "3.1 Flash Lite"], ["gemini-2.5-flash-lite", "2.5 Flash Lite"], ["gemini-2.5-flash", "2.5 Flash"], ["gemini-3-flash", "3 Flash"], ["gemini-3.5-flash", "3.5 Flash"], ["gemma-4-26b", "Gemma 4 26B"], ["gemma-4-31b", "Gemma 4 31B"]] },
  { label: "Audio", models: [["gemini-2.5-flash-tts", "2.5 Flash TTS"], ["gemini-3.1-flash-tts", "3.1 Flash TTS"], ["gemini-2.5-flash-native-audio-dialog", "2.5 Flash Native Audio Dialog"], ["gemini-3-flash-live", "3 Flash Live"], ["gemini-3.5-live-translate", "3.5 Live Translate"]] },
  { label: "Embeddings", models: [["gemini-embedding-1", "Embedding 1"], ["gemini-embedding-2", "Embedding 2"]] },
  { label: "Robotics", models: [["gemini-robotics-er-1.5-preview", "Robotics ER 1.5 Preview"], ["gemini-robotics-er-1.6-preview", "Robotics ER 1.6 Preview"]] },
];

export async function mount({ root = document, url = window.location } = {}) {
  const lifecycle = new AbortController();
  let mounted = true;
  const signal = lifecycle.signal;
  const query = (selector) => root.querySelector(selector);
  const sessionStatus = query("#session-status");
  const logoutButton = query("#logout-button");
  const tester = query("#tester");
  const form = query("#kairen-form");
  const messageInput = query("#message");
  const submitButton = query("#submit-button");
  const clearButton = query("#clear-button");
  const chatOutput = query("#chat-output");
  const providerSelect = query("#ai-provider");
  const modelSelect = query("#ai-model");
  const activeModel = query("#active-model");
  const messages = [];

  const isActive = () => mounted && !signal.aborted;
  const teardown = () => { mounted = false; lifecycle.abort(); };
  if (!new URL(import.meta.url).searchParams.has("hr_spa")) window.HiddenRoomApp?.register(teardown);
  const setStatus = (message) => { if (isActive() && sessionStatus) sessionStatus.textContent = message; };

  try {
    const supabase = await window.HiddenRoomSupabase.getClient();
    if (!isActive()) return teardown;

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (!isActive()) return teardown;
    if (userError || !user) {
      sessionStorage.setItem("hr_return_after_login", "/kairen/");
      window.location.replace("/portal/");
      return teardown;
    }

    logoutButton && (logoutButton.hidden = false);
    root.querySelectorAll("[data-hr-account]").forEach((accountLink) => {
      accountLink.textContent = user.email || "Usuario";
      accountLink.setAttribute("href", "/portal/dashboard.html");
    });

    const [{ data: profile, error: profileError }, { data: permission, error: permissionError }] = await Promise.all([
      supabase.from("users").select("roles").eq("id", user.id).maybeSingle(),
      supabase.from("user_permissions").select("id").eq("user_id", user.id).eq("permission_key", KAIREN_PERMISSION).maybeSingle(),
    ]);
    if (!isActive()) return teardown;
    if (profileError || permissionError) {
      setStatus(`No se pudo validar el acceso: ${(profileError || permissionError).message}`);
      return teardown;
    }

    const isAdmin = String(profile?.roles ?? "").split(",").map((role) => role.trim().toLowerCase()).includes("admin");
    if (!isAdmin && !permission) {
      setStatus(`Acceso denegado para ${user.email ?? user.id}. Se requiere el permiso ${KAIREN_PERMISSION}.`);
      return teardown;
    }

    initializeModelSelector(providerSelect, modelSelect, activeModel);
    await loadProviderAvailability(supabase, providerSelect, modelSelect, activeModel, isActive);
    if (!isActive()) return teardown;
    setStatus(`Sesion autorizada: ${user.email ?? user.id}`);
    if (tester) tester.hidden = false;

    form?.addEventListener("submit", (event) => submitMessage(event, { supabase, messages, providerSelect, modelSelect, messageInput, submitButton, activeModel, chatOutput, isActive }), { signal });
    messageInput?.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
      event.preventDefault();
      if (!messageInput.disabled && !submitButton.disabled && messageInput.value.trim()) form?.requestSubmit(submitButton);
    }, { signal });
    clearButton?.addEventListener("click", () => { messages.length = 0; renderMessages(chatOutput, messages); messageInput?.focus(); }, { signal });
    providerSelect?.addEventListener("change", () => { localStorage.setItem(PROVIDER_STORAGE_KEY, providerSelect.value); syncActiveModel(providerSelect, modelSelect, activeModel); }, { signal });
    modelSelect?.addEventListener("change", () => { localStorage.setItem(MODEL_STORAGE_KEY, modelSelect.value); syncActiveModel(providerSelect, modelSelect, activeModel); }, { signal });
    logoutButton?.addEventListener("click", async () => {
      logoutButton.disabled = true;
      await supabase.auth.signOut();
      if (isActive()) window.location.replace("/portal/");
    }, { signal });
  } catch (error) {
    setStatus(error?.message || "No se pudo cargar Kairen.");
  }

  return teardown;
}

async function submitMessage(event, context) {
  event.preventDefault();
  const { supabase, messages, providerSelect, modelSelect, messageInput, submitButton, activeModel, chatOutput, isActive } = context;
  const text = messageInput.value.trim();
  if (!text || !isActive()) return;
  messages.push({ role: "user", text });
  renderMessages(chatOutput, messages);
  messageInput.value = "";
  submitButton.disabled = true;
  messageInput.disabled = true;
  try {
    const { data, error } = await supabase.functions.invoke("kairen-gemini", { body: { provider: providerSelect.value, model: modelSelect.value, message: text, history: messages.slice(0, -1).filter((message) => message.role === "user" || message.role === "model") } });
    if (!isActive()) return;
    const reply = error || !data?.reply ? { role: "error", text: await functionErrorMessage(error, data) } : { role: "model", text: data.reply };
    if (!isActive()) return;
    messages.push(reply);
    renderMessages(chatOutput, messages);
    submitButton.disabled = false;
    messageInput.disabled = false;
    messageInput.focus();
  } catch (error) {
    if (!isActive()) return;
    messages.push({ role: "error", text: error?.message || "No se pudo obtener respuesta." });
    renderMessages(chatOutput, messages);
    submitButton.disabled = false;
    messageInput.disabled = false;
  }
}

function initializeModelSelector(providerSelect, modelSelect, activeModel) {
  if (!providerSelect || !modelSelect) return;
  modelSelect.replaceChildren();
  MODEL_GROUPS.forEach((group) => {
    const optgroup = document.createElement("optgroup");
    optgroup.label = group.label;
    group.models.forEach(([value, label]) => { const option = document.createElement("option"); option.value = value; option.textContent = label; optgroup.append(option); });
    modelSelect.append(optgroup);
  });
  const savedProvider = localStorage.getItem(PROVIDER_STORAGE_KEY);
  const savedModel = localStorage.getItem(MODEL_STORAGE_KEY);
  providerSelect.value = [...providerSelect.options].some((option) => option.value === savedProvider && !option.disabled) ? savedProvider : DEFAULT_PROVIDER;
  modelSelect.value = [...modelSelect.options].some((option) => option.value === savedModel) ? savedModel : DEFAULT_MODEL;
  syncActiveModel(providerSelect, modelSelect, activeModel);
}

async function loadProviderAvailability(supabase, providerSelect, modelSelect, activeModel, isActive = () => true) {
  const { data } = await supabase.functions.invoke("kairen-gemini", { body: { action: "config" } });
  if (!isActive()) return;
  const availability = data?.providers ?? {};
  for (const option of providerSelect.options) {
    if (!isActive()) return;
    const available = Boolean(availability[option.value]);
    option.disabled = !available;
    option.textContent = available ? providerLabel(option.value) : `${providerLabel(option.value)} (no configurado)`;
  }
  if (providerSelect.selectedOptions[0]?.disabled) providerSelect.value = availability.gemini ? "gemini" : "";
  syncActiveModel(providerSelect, modelSelect, activeModel);
}

function syncActiveModel(providerSelect, modelSelect, activeModel) {
  if (activeModel) activeModel.textContent = `[Kairen | ${providerLabel(providerSelect?.value)} | ${modelSelect?.selectedOptions[0]?.textContent || modelSelect?.value}]`;
}
function providerLabel(provider) { return { gemini: "Google AI", openrouter: "OpenRouter", ollama: "Ollama" }[provider] || provider; }
function renderMessages(chatOutput, messages) {
  if (!chatOutput) return;
  chatOutput.replaceChildren();
  messages.forEach((message) => {
    const block = document.createElement("p");
    const label = message.role === "user" ? "TÃº" : message.role === "model" ? "Kairen" : "Error";
    const strong = document.createElement("strong");
    strong.textContent = `${label}: `;
    block.append(strong, document.createTextNode(message.text));
    chatOutput.append(block);
  });
}
async function functionErrorMessage(error, data) {
  if (data?.error) return data.error;
  const response = error?.context;
  try { const body = await response?.clone?.().json(); if (body?.error) return body.error; } catch {}
  try { const body = await response?.clone?.().text(); if (body) return body; } catch {}
  return [error?.message, response?.status ? `HTTP ${response.status}` : "", response?.statusText].filter(Boolean).join(" - ") || "No se pudo obtener respuesta.";
}

if (!new URL(import.meta.url).searchParams.has("hr_spa")) mount({ root: document.getElementById("hr-spa-content") || document, url: new URL(window.location.href) });
