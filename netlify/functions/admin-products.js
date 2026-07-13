// netlify/functions/admin-products.js
//
// Admin-only. Manages products (priced items) within a sale. Gated by the
// same x-admin-code header as admin-sales.js.
//
// GET ?saleId=...              -> list products for a sale
// POST { action: "create", saleId, name, priceCents }
// POST { action: "update", productId, name, priceCents }
// POST { action: "delete", productId }

const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function isAuthorized(event) {
  const code = event.headers["x-admin-code"];
  return code && process.env.ADMIN_ACCESS_CODE && code === process.env.ADMIN_ACCESS_CODE;
}

exports.handler = async (event) => {
  if (!isAuthorized(event)) {
    return { statusCode: 401, body: JSON.stringify({ error: "Not authorized." }) };
  }

  if (event.httpMethod === "GET") {
    const saleId = event.queryStringParameters && event.queryStringParameters.saleId;
    if (!saleId) return { statusCode: 400, body: JSON.stringify({ error: "saleId query param is required." }) };

    const { data, error } = await supabase
      .from("products")
      .select("id, name, price_cents, sort_order")
      .eq("sale_id", saleId)
      .order("sort_order", { ascending: true });

    if (error) return { statusCode: 500, body: JSON.stringify({ error: "Could not load products." }) };
    return { statusCode: 200, body: JSON.stringify({ products: data }) };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON body." }) };
  }

  const { action } = body;

  if (action === "create") {
    const { saleId, name, priceCents } = body;
    if (!saleId || !name || !name.trim() || !Number.isFinite(priceCents)) {
      return { statusCode: 400, body: JSON.stringify({ error: "saleId, name, and priceCents are required." }) };
    }
    const { data, error } = await supabase
      .from("products")
      .insert({ sale_id: saleId, name: name.trim(), price_cents: Math.round(priceCents) })
      .select()
      .single();
    if (error) return { statusCode: 500, body: JSON.stringify({ error: "Could not create product." }) };
    return { statusCode: 200, body: JSON.stringify({ product: data }) };
  }

  if (action === "update") {
    const { productId, name, priceCents } = body;
    if (!productId) return { statusCode: 400, body: JSON.stringify({ error: "productId is required." }) };

    const updates = {};
    if (name && name.trim()) updates.name = name.trim();
    if (Number.isFinite(priceCents)) updates.price_cents = Math.round(priceCents);

    const { data, error } = await supabase
      .from("products")
      .update(updates)
      .eq("id", productId)
      .select()
      .single();
    if (error) return { statusCode: 500, body: JSON.stringify({ error: "Could not update product." }) };
    return { statusCode: 200, body: JSON.stringify({ product: data }) };
  }

  if (action === "delete") {
    const { productId } = body;
    if (!productId) return { statusCode: 400, body: JSON.stringify({ error: "productId is required." }) };
    const { error } = await supabase.from("products").delete().eq("id", productId);
    if (error) return { statusCode: 500, body: JSON.stringify({ error: "Could not delete product." }) };
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  }

  return { statusCode: 400, body: JSON.stringify({ error: "Unknown action." }) };
};
