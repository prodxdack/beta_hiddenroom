import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { MercadoPagoConfig, Order } from "npm:mercadopago";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type RequestedItem = {
  id?: unknown;
  quantity?: unknown;
  beat_id?: unknown;
  license_id?: unknown;
};

type RequestedCartItem = {
  id: string;
  quantity: number;
  beatId: string | null;
  licenseId: string | null;
};

type StoreProduct = {
  id: string;
  name: string;
  producer: string | null;
  category: string;
  price: number | string;
  currency: string;
  stock: number | null;
  is_digital: boolean;
  is_active: boolean;
};

type BeatAssignment = {
  beat_id: string;
  license_id: string;
  price: number | string;
  is_enabled: boolean;
  beat_licenses: {
    id: string;
    name: string;
    description: string;
    terms: string | null;
    stream_limit: number | null;
    unlimited_streams: boolean;
    format: string | null;
    is_active: boolean;
  } | null;
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function cleanText(value: unknown, maxLength: number) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function normalizeRequestedItems(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) throw new Error("El carrito esta vacio.");
  if (value.length > 30) throw new Error("El carrito contiene demasiadas lineas.");

  const items = new Map<string, RequestedCartItem>();
  value.forEach((item: RequestedItem) => {
    const id = cleanText(item?.id, 100);
    const quantity = Number(item?.quantity);
    if (!id) throw new Error("Hay un producto sin id.");
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
      throw new Error("Hay una cantidad invalida.");
    }

    const beatId = cleanText(item?.beat_id, 100) || null;
    const licenseId = cleanText(item?.license_id, 100) || null;
    if ((beatId && !validUuid(beatId)) || (licenseId && !validUuid(licenseId))) {
      throw new Error("La seleccion de beat o licencia no es valida.");
    }
    const key = `${id}::${licenseId ?? ""}`;
    const combined = (items.get(key)?.quantity ?? 0) + quantity;
    if (combined > 10) throw new Error("La cantidad maxima por producto es 10.");
    items.set(key, { id, quantity: combined, beatId, licenseId });
  });

  return [...items.values()];
}

function paymentStatus(value: unknown) {
  return cleanText(value, 40).toLowerCase() || "pending";
}

function paymentIdFrom(orderResult: Record<string, any>) {
  const payment = orderResult.transactions?.payments?.[0];
  return String(payment?.id ?? payment?.payment_id ?? "");
}

function providerErrorDetails(error: unknown) {
  const source = (error && typeof error === "object") ? error as Record<string, any> : {};
  const cause = Array.isArray(source.cause) ? source.cause[0] : source.cause;
  const status = Number(source.status ?? source.statusCode ?? cause?.status);
  const code = cleanText(source.code ?? cause?.code ?? cause?.error, 80);
  const message = cleanText(source.message ?? cause?.message ?? cause?.description, 220)
    .replace(/[\r\n]+/g, " ");
  return {
    status: Number.isInteger(status) && status >= 400 && status < 500 ? status : 502,
    code,
    message,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const accessToken = Deno.env.get("MP_ACCESS_TOKEN");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!accessToken || !supabaseUrl || !serviceRoleKey) {
    return json({ error: "Mercado Pago no esta configurado." }, 500);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "JSON invalido." }, 400);
  }

  const customer = (body.customer ?? {}) as Record<string, unknown>;
  const card = (body.card ?? {}) as Record<string, any>;
  const name = cleanText(customer.name, 120);
  const email = cleanText(customer.email || card.payer?.email, 254).toLowerCase();
  const phone = cleanText(customer.phone, 30);
  if (!name || !email || !phone) {
    return json({ error: "Nombre, correo y telefono son obligatorios." }, 400);
  }
  if (!validEmail(email)) return json({ error: "El correo no es valido." }, 400);

  const token = cleanText(card.token, 200);
  const paymentMethodId = cleanText(card.payment_method_id, 80);
  const paymentType = cleanText(card.payment_type_id || "credit_card", 40);
  const installments = Number(card.installments);
  const brickPayer = (card.payer ?? {}) as Record<string, any>;
  const identification = (brickPayer.identification ?? {}) as Record<string, any>;
  const payerIdentificationType = cleanText(identification.type, 30);
  const payerIdentificationNumber = cleanText(identification.number, 40);
  if (!token || !paymentMethodId || !Number.isInteger(installments) || installments < 1) {
    return json({ error: "Los datos de tarjeta estan incompletos." }, 400);
  }

  let requestedItems: RequestedCartItem[];
  try {
    requestedItems = normalizeRequestedItems(body.items);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Carrito invalido." }, 400);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const authorization = req.headers.get("Authorization") ?? "";
  const bearerToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  let userId: string | null = null;
  if (bearerToken && bearerToken !== anonKey) {
    const { data: authData } = await admin.auth.getUser(bearerToken);
    userId = authData.user?.id ?? null;
  }

  const productIds = [...new Set(requestedItems.map((item) => item.id))];
  const { data: productRows, error: productsError } = await admin
    .from("store_products")
    .select("id, name, category, price, currency, stock, is_digital, is_active, producer")
    .in("id", productIds);

  if (productsError) return json({ error: productsError.message }, 500);
  if (productRows?.length !== productIds.length) {
    return json({ error: "Uno o mas productos ya no estan disponibles." }, 400);
  }

  const products = productRows as StoreProduct[];
  const productById = new Map(products.map((product) => [product.id, product]));
  const beatItems = requestedItems.filter((item) => productById.get(item.id)?.category === "beats");
  if (beatItems.some((item) => !item.licenseId || !userId)) {
    return json({ error: "Las licencias de beats requieren iniciar sesion para conservar la compra y la descarga." }, 401);
  }
  if (requestedItems.some((item) => productById.get(item.id)?.category !== "beats" && (item.licenseId || item.beatId))) {
    return json({ error: "La seleccion de licencia no corresponde a un beat." }, 400);
  }

  const licenseKeys = beatItems.map((item) => item.licenseId as string);
  const assignmentByKey = new Map<string, BeatAssignment>();
  if (beatItems.length) {
    const { data: assignments, error: assignmentsError } = await admin
      .from("beat_license_assignments")
      .select("beat_id, license_id, price, is_enabled, beat_licenses(id, name, description, terms, stream_limit, unlimited_streams, format, is_active)")
      .in("beat_id", beatItems.map((item) => item.id))
      .in("license_id", [...new Set(licenseKeys)]);
    if (assignmentsError) return json({ error: assignmentsError.message }, 500);
    for (const assignment of (assignments ?? []) as BeatAssignment[]) {
      assignmentByKey.set(`${assignment.beat_id}::${assignment.license_id}`, assignment);
    }
  }
  const currencies = new Set(products.map((product) => product.currency.toUpperCase()));
  if (currencies.size !== 1) {
    return json({ error: "Todos los productos deben usar la misma moneda." }, 400);
  }

  for (const product of products) {
    const productItems = requestedItems.filter((item) => item.id === product.id);
    const quantity = productItems.reduce((sum, item) => sum + item.quantity, 0);
    if (!product.is_active) return json({ error: `${product.name} ya no esta disponible.` }, 400);
    if (product.stock !== null && product.stock < quantity) {
      return json({ error: `No hay stock suficiente de ${product.name}.` }, 400);
    }
    for (const item of productItems) {
      if (product.category !== "beats") continue;
      if (item.quantity !== 1) return json({ error: "Una licencia digital solo puede comprarse una vez por linea." }, 400);
      if (item.beatId && item.beatId !== product.id) return json({ error: "El beat seleccionado no coincide con el producto." }, 400);
      const assignment = assignmentByKey.get(`${product.id}::${item.licenseId}`);
      if (!assignment || !assignment.is_enabled || !assignment.beat_licenses?.is_active) {
        return json({ error: `${product.name}: la licencia seleccionada ya no esta disponible.` }, 409);
      }
    }
  }

  const currency = [...currencies][0];
  const subtotal = requestedItems.reduce((sum, item) => {
    const product = productById.get(item.id)!;
    const assignment = item.licenseId ? assignmentByKey.get(`${item.id}::${item.licenseId}`) : null;
    return sum + Number(assignment?.price ?? product.price) * item.quantity;
  }, 0);
  const roundedTotal = Math.round(subtotal * 100) / 100;
  const reference = `hr_${crypto.randomUUID()}`;

  const { data: storeOrder, error: storeOrderError } = await admin
    .from("store_orders")
    .insert({
      user_id: userId,
      customer_name: name,
      customer_email: email,
      customer_phone: phone,
      status: "pending",
      subtotal: roundedTotal,
      total: roundedTotal,
      currency,
      provider: "mercadopago",
      external_reference: reference,
    })
    .select("id")
    .single();

  if (storeOrderError || !storeOrder) {
    return json({ error: storeOrderError?.message || "No se pudo crear la orden." }, 500);
  }

  const orderItems = requestedItems.map((item) => {
    const product = productById.get(item.id)!;
    const assignment = item.licenseId ? assignmentByKey.get(`${item.id}::${item.licenseId}`) : null;
    const license = assignment?.beat_licenses;
    const unitPrice = Number(assignment?.price ?? product.price);
    return {
      order_id: storeOrder.id,
      product_id: product.id,
      product_name: product.name,
      beat_id: item.licenseId ? product.id : null,
      license_id: item.licenseId,
      producer_name: product.producer ?? null,
      license_name: license?.name ?? null,
      license_snapshot: license ? { id: license.id, name: license.name, description: license.description, terms: license.terms, stream_limit: license.stream_limit, unlimited_streams: license.unlimited_streams, format: license.format, price: unitPrice, currency: product.currency } : {},
      quantity: item.quantity,
      unit_price: unitPrice,
      total: Math.round(unitPrice * item.quantity * 100) / 100,
    };
  });

  const { error: itemsError } = await admin.from("store_order_items").insert(orderItems);
  if (itemsError) {
    await admin.from("store_orders").delete().eq("id", storeOrder.id);
    return json({ error: itemsError.message }, 500);
  }

  const { data: genericOrder, error: genericOrderError } = await admin
    .from("orders")
    .insert({
      user_id: userId,
      store_order_id: storeOrder.id,
      status: "pending",
      reference,
      provider: "mercadopago",
      amount: roundedTotal,
      currency,
      metadata: { customer: { name, email, phone } },
    })
    .select("id")
    .single();

  if (genericOrderError || !genericOrder) {
    await admin.from("store_orders").delete().eq("id", storeOrder.id);
    return json({ error: genericOrderError?.message || "No se pudo registrar la orden." }, 500);
  }

  const client = new MercadoPagoConfig({ accessToken, options: { timeout: 7000 } });
  const order = new Order(client);
  const mpBody = {
    type: "online",
    processing_mode: "automatic",
    total_amount: roundedTotal.toFixed(2),
    external_reference: reference,
    payer: {
      email,
      ...(payerIdentificationType && payerIdentificationNumber ? {
        identification: {
          type: payerIdentificationType,
          number: payerIdentificationNumber,
        },
      } : {}),
    },
    transactions: {
      payments: [{
        amount: roundedTotal.toFixed(2),
        payment_method: {
          id: paymentMethodId,
          type: paymentType,
          token,
          installments,
          statement_descriptor: "Hidden Room",
        },
      }],
    },
  };

  try {
    const mpOrder = await order.create({
      body: mpBody,
      requestOptions: { idempotencyKey: reference },
    }) as Record<string, any>;
    const providerOrderId = String(mpOrder.id ?? "");
    const providerPaymentId = paymentIdFrom(mpOrder);
    const status = paymentStatus(mpOrder.status ?? mpOrder.transactions?.payments?.[0]?.status);

    await admin.from("store_orders").update({
      provider_order_id: providerOrderId || null,
      provider_payment_id: providerPaymentId || null,
    }).eq("id", storeOrder.id);

    const { error: fulfillError } = await admin.rpc("fulfill_store_order_provider", {
      p_order_id: storeOrder.id,
      p_provider: "mercadopago",
      p_provider_order_id: providerOrderId || null,
      p_provider_payment_id: providerPaymentId || providerOrderId || reference,
      p_status: status,
      p_raw_response: mpOrder,
    });

    if (fulfillError) {
      console.error("Mercado Pago fulfillment failed", fulfillError.message);
      return json({ error: "El pago fue procesado, pero no pudo actualizarse la orden." }, 500);
    }

    return json({
      order_id: storeOrder.id,
      reference,
      provider: "mercadopago",
      provider_order_id: providerOrderId,
      payment_id: providerPaymentId,
      status,
      result: mpOrder,
    });
  } catch (error) {
    await admin.from("store_orders").update({ status: "cancelled" }).eq("id", storeOrder.id);
    const details = providerErrorDetails(error);
    console.error("Mercado Pago order error", {
      status: details.status,
      code: details.code,
      message: details.message,
    });
    const reason = details.code || details.message;
    return json({
      error: reason
        ? `Mercado Pago rechazo la solicitud: ${reason}`
        : "Mercado Pago rechazo la solicitud de pago.",
      provider_code: details.code || null,
    }, details.status);
  }
});
