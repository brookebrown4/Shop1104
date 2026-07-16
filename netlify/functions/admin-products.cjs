// netlify/functions/admin-products.js
//
// Admin-only. Manages products (priced items) within a sale. Gated by the
// same x-admin-code header as admin-sales.js.
//
// Each product can define its own:
//   - sizes: [{ name, extraCost }]  -- if empty, a generic size list is used
//   - colors: [{ name, extraCost }] -- if empty, no color choice is shown
//   - logos:  [{ name, extraCost }] -- if empty, no logo/design choice is shown
//   - image: a base64 photo (optional)
// extraCost is added on top of the base price when a customer picks that option.
//
// GET ?saleId=...              -> list products for a sale
// POST { action: "create", saleId, name, priceCents, sizes?, colors?, logos?, image? }
// POST { action: "update", productId, name, priceCents, sizes?, colors?, logos?, image? }
// POST { action: "delete", productId }

const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function isAuthorized(event) {
  const code = event.headers["x-admin-code"];
  return code && process.env.ADMIN_ACCESS_CODE && code === process.env.ADMIN_ACCESS_CODE;
}

function cleanOptionList(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((o) => o && o.name && o.name.trim())
    .map((o) => ({ name: o.name.trim(), extraCost: Number.isFinite(Number(o.extraCost)) ? Math.round(Number(o.extraCost) * 100) : 0 }));
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
      .select("id, name, price_cents, sort_order, colors, sizes, logos, image_data")
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
      .insert({
        sale_id: saleId,
        name: name.trim(),
        price_cents: Math.round(priceCents),
        colors: cleanOptionList(body.colors),
        sizes: cleanOptionList(body.sizes),
        logos: cleanOptionList(body.logos),
        image_data: body.image || null,
      })
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
    if (body.colors !== undefined) updates.colors = cleanOptionList(body.colors);
    if (body.sizes !== undefined) updates.sizes = cleanOptionList(body.sizes);
    if (body.logos !== undefined) updates.logos = cleanOptionList(body.logos);
    if (body.image !== undefined) updates.image_data = body.image || null;

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
