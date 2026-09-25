import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function cleanText(value: unknown, maxLength = 160) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function paymentStatus(value: unknown) {
  const status = cleanText(value, 40).toLowerCase();
  const normalizedStatuses: Record<string, string> = {
    processed: "paid",
    processing: "pending",
    created: "pending",
    action_required: "pending",
    canceled: "cancelled",
    cancelled: "cancelled",
    partially_refunded: "partially_refunded",
    refunded: "refunded",
    charged_back: "charged_back",
  };
  return normalizedStatuses[status] ?? (status || "pending");
}

function parseSignatureHeader(header: string) {
  return header.split(",").reduce<Record<string, string>>((parts, item) => {
    const [key, value] = item.split("=", 2);
    const safeKey = cleanText(key, 20);
    if (safeKey) parts[safeKey] = cleanText(value, 256);
    return parts;
  }, {});
}

function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqualHex(left: string, right: string) {
  if (!/^[a-f0-9]+$/i.test(left) || !/^[a-f0-9]+$/i.test(right)) return false;
  if (left.length !== right.length) return false;

  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return diff === 0;
}

async function verifyMercadoPagoSignature(req: Request, dataId: string, secret: string) {
  const signatureHeader = req.headers.get("x-signature") ?? "";
  const requestId = cleanText(req.headers.get("x-request-id"), 160);
  const signature = parseSignatureHeader(signatureHeader);
  const ts = signature.ts;
  const hash = signature.v1;

  if (!dataId || !requestId || !ts || !hash) return false;

  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`;
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    new TextEncoder().encode(manifest),
  );

  return timingSafeEqualHex(toHex(digest), hash.toLowerCase());
}

function moneyValue(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
}

function moneyMatches(left: number, right: number) {
  return Math.abs(left - right) < 0.01;
}

async function fetchMercadoPagoResource(accessToken: string, topic: string, id: string) {
  const safeTopic = topic.toLowerCase();
  const endpoint = safeTopic.includes("payment")
    ? `https://api.mercadopago.com/v1/payments/${encodeURIComponent(id)}`
    : `https://api.mercadopago.com/v1/orders/${encodeURIComponent(id)}`;

  const response = await fetch(endpoint, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("Mercado Pago webhook fetch failed", response.status, payload?.message);
    throw new Error("No se pudo validar la notificacion.");
  }
  return payload as Record<string, any>;
}

function notificationTarget(req: Request, body: Record<string, any>) {
  const url = new URL(req.url);
  const topic = cleanText(
    body.type ?? body.topic ?? url.searchParams.get("type") ?? url.searchParams.get("topic"),
    80,
  );
  const id = cleanText(
    url.searchParams.get("data.id") ?? body.data?.id ?? body.resource?.id ?? body.id ??
      url.searchParams.get("id"),
    120,
  );

  return { topic, id };
}

function extractPayment(resource: Record<string, any>, topic: string) {
  if (topic.toLowerCase().includes("payment")) {
    return {
      reference: cleanText(resource.external_reference),
      status: paymentStatus(resource.status),
      paymentId: cleanText(resource.id),
      providerOrderId: cleanText(resource.order?.id ?? resource.order_id),
      amount: moneyValue(resource.transaction_amount ?? resource.total_paid_amount),
      currency: cleanText(resource.currency_id, 10).toUpperCase(),
      raw: resource,
    };
  }

  const payment = resource.transactions?.payments?.[0] ?? {};
  return {
    reference: cleanText(resource.external_reference),
    status: paymentStatus(payment.status ?? resource.status),
    paymentId: cleanText(payment.id ?? payment.payment_id),
    providerOrderId: cleanText(resource.id),
    amount: moneyValue(payment.amount ?? payment.total_paid_amount ?? resource.total_amount),
    currency: cleanText(payment.currency_id ?? resource.currency_id ?? resource.currency, 10)
      .toUpperCase(),
    raw: resource,
  };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: "Webhook no configurado." }, 500);
  }
  const admin = createClient(supabaseUrl, serviceRoleKey);
  const { data: runtimeConfig } = await admin.rpc("mp_runtime_config");
  const accessToken = runtimeConfig?.access_token || Deno.env.get("MP_ACCESS_TOKEN");
  const webhookSecret = runtimeConfig?.webhook_secret || Deno.env.get("MP_WEBHOOK_SECRET");
  if (!accessToken || !webhookSecret) return json({ error: "Webhook no configurado." }, 500);

  let body: Record<string, any> = {};
  try {
    body = JSON.parse(await req.text());
  } catch {
    body = {};
  }

  const { topic, id } = notificationTarget(req, body);
  if (!topic || !id) return json({ error: "Notificacion incompleta." }, 400);

  const signatureOk = await verifyMercadoPagoSignature(req, id, webhookSecret);
  if (!signatureOk) return json({ error: "Firma invalida." }, 401);

  let resource: Record<string, any>;
  try {
    resource = await fetchMercadoPagoResource(accessToken, topic, id);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Notificacion invalida." }, 400);
  }

  const payment = extractPayment(resource, topic);
  if (!payment.reference) return json({ error: "La notificacion no contiene referencia." }, 400);

  const { data: storeOrder, error: orderError } = await admin
    .from("store_orders")
    .select("id,total,currency")
    .eq("external_reference", payment.reference)
    .maybeSingle();

  if (orderError) return json({ error: orderError.message }, 500);
  if (!storeOrder) return json({ received: true, ignored: "unknown_reference" });

  const expectedTotal = moneyValue(storeOrder.total);
  const expectedCurrency = cleanText(storeOrder.currency, 10).toUpperCase();
  if (
    expectedTotal === null ||
    payment.amount === null ||
    !moneyMatches(payment.amount, expectedTotal) ||
    payment.currency !== expectedCurrency
  ) {
    console.error("Mercado Pago webhook amount mismatch", {
      order: storeOrder.id,
      expectedTotal,
      expectedCurrency,
      receivedAmount: payment.amount,
      receivedCurrency: payment.currency,
    });
    return json({ error: "La notificacion no coincide con la orden." }, 400);
  }

  const providerEventId = `${topic.toLowerCase()}:${id}`;
  const { data, error } = await admin.rpc("process_store_payment_event", {
    p_order_id: storeOrder.id,
    p_provider: "mercadopago",
    p_provider_event_id: providerEventId,
    p_idempotency_key: providerEventId,
    p_provider_order_id: payment.providerOrderId || null,
    p_provider_payment_id: payment.paymentId || payment.providerOrderId || payment.reference,
    p_event_type: payment.status,
    p_provider_event_at: resource.date_created || resource.date_last_updated || null,
    p_amount: payment.amount,
    p_currency: payment.currency,
    p_payload: {
      source: "mercadopago-webhook",
      topic,
      provider_event_id: id,
      reference: payment.reference,
      status: payment.status,
      provider_order_id: payment.providerOrderId || null,
      provider_payment_id: payment.paymentId || null,
      amount: payment.amount,
      currency: payment.currency,
    },
  });

  if (error) {
    console.error("Mercado Pago webhook fulfillment failed", error.message);
    return json({ error: "No se pudo actualizar la orden." }, 500);
  }

  return json({ received: true, fulfilled: data });
});
