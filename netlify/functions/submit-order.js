// netlify/functions/submit-order.js
//
// Saves an incoming pre-order to Supabase with status "pending", before
// the customer is sent to Stripe to pay. Prices are looked up server-side
// from the active sale's products -- the browser only ever sends product
// IDs, never prices, so nothing about the charge can be tampered with
// client-side.

const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  let order;
  try {
    order = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON body." }) };
  }

  const { name, email, phone, saleId, garments, fulfillment, address } = order || {};

  if (!name || !email || !phone || !saleId || !Array.isArray(garments) || garments.length === 0) {
    return { statusCode: 400, body: JSON.stringify({ error: "Missing required order fields." }) };
  }

  // Confirm this is really the active sale -- prevents someone submitting
  // against a sale that's since been deactivated or changed.
  const { data: sale, error: saleErr } = await supabase
    .from("sales")
    .select("id")
    .eq("id", saleId)
    .eq("is_active", true)
    .maybeSingle();

  if (saleErr) {
    console.error("Supabase error (sale check):", saleErr);
    return { statusCode: 500, body: JSON.stringify({ error: "Could not verify sale." }) };
  }
  if (!sale) {
    return { statusCode: 400, body: JSON.stringify({ error: "This sale is no longer active." }) };
  }

  // Look up real prices for the selected products -- never trust prices
  // sent from the client.
  const productIds = [...new Set(garments.map((g) => g.productId))];
  const { data: products, error: prodErr } = await supabase
    .from("products")
    .select("id, name, price_cents, colors")
    .eq("sale_id", saleId)
    .in("id", productIds);

  if (prodErr) {
    console.error("Supabase error (products lookup):", prodErr);
    return { statusCode: 500, body: JSON.stringify({ error: "Could not price order." }) };
  }

  const productMap = new Map(products.map((p) => [p.id, p]));

  let amountCents = 0;
  const enrichedGarments = [];
  for (const g of garments) {
    const product = productMap.get(g.productId);
    if (!product) {
      return { statusCode: 400, body: JSON.stringify({ error: "One or more items are no longer available." }) };
    }
    if (!g.color || !g.color.trim() || !g.size) {
      return { statusCode: 400, body: JSON.stringify({ error: "Each garment needs a color and size." }) };
    }
    if (Array.isArray(product.colors) && product.colors.length > 0 && !product.colors.includes(g.color)) {
      return { statusCode: 400, body: JSON.stringify({ error: `"${g.color}" isn't an available color for ${product.name}.` }) };
    }
    amountCents += product.price_cents;
    enrichedGarments.push({
      product_id: product.id,
      product_name: product.name,
      price_cents: product.price_cents,
      color: g.color.trim(),
      size: g.size,
    });
  }

  const { data, error } = await supabase
    .from("orders")
    .insert({
      status: "pending",
      sale_id: saleId,
      customer_name: name,
      customer_email: email,
      customer_phone: phone,
      garments: enrichedGarments,
      fulfillment,
      address: fulfillment === "ship" ? address : null,
      amount_cents: amountCents,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Supabase insert error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: "Could not save order." }) };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ orderId: data.id, amountCents }),
  };
};
