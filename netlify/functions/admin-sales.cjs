// netlify/functions/admin-sales.js
//
// Admin-only. Manages "sales" (pre-order events). Gated by an admin code
// sent in the x-admin-code header, checked against ADMIN_ACCESS_CODE.
//
// Multiple sales can be active at the same time -- each gets its own
// shareable slug (e.g. /preorder/summer-2026-a1b2), set once at creation
// and never changed by a rename, so links you've already shared keep working.
//
// GET                          -> list all sales, newest first (includes slug)
// POST { action: "create", name }
// POST { action: "activate", saleId }    -> turns this sale on (others unaffected)
// POST { action: "deactivate", saleId }  -> turns this sale off
// POST { action: "rename", saleId, name } -> changes display name only, not the slug
// POST { action: "delete", saleId }      -> also deletes its products (cascade)

const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function isAuthorized(event) {
  const code = event.headers["x-admin-code"];
  return code && process.env.ADMIN_ACCESS_CODE && code === process.env.ADMIN_ACCESS_CODE;
}

function slugify(name) {
  const base = (name || "sale")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base}-${suffix}`;
}

exports.handler = async (event) => {
  if (!isAuthorized(event)) {
    return { statusCode: 401, body: JSON.stringify({ error: "Not authorized." }) };
  }

  if (event.httpMethod === "GET") {
    const { data, error } = await supabase
      .from("sales")
      .select("id, name, slug, is_active, created_at, products(count)")
      .order("created_at", { ascending: false });

    if (error) return { statusCode: 500, body: JSON.stringify({ error: "Could not load sales." }) };
    return { statusCode: 200, body: JSON.stringify({ sales: data }) };
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
    if (!body.name || !body.name.trim()) {
      return { statusCode: 400, body: JSON.stringify({ error: "Sale name is required." }) };
    }
    let slug = slugify(body.name);
    // Extremely unlikely collision, but guard anyway.
    for (let i = 0; i < 5; i++) {
      const { data: existing } = await supabase.from("sales").select("id").eq("slug", slug).maybeSingle();
      if (!existing) break;
      slug = slugify(body.name);
    }
    const { data, error } = await supabase
      .from("sales")
      .insert({ name: body.name.trim(), slug, is_active: false })
      .select()
      .single();
    if (error) return { statusCode: 500, body: JSON.stringify({ error: "Could not create sale." }) };
    return { statusCode: 200, body: JSON.stringify({ sale: data }) };
  }

  if (action === "activate" || action === "deactivate") {
    if (!body.saleId) return { statusCode: 400, body: JSON.stringify({ error: "saleId is required." }) };
    const { data, error } = await supabase
      .from("sales")
      .update({ is_active: action === "activate" })
      .eq("id", body.saleId)
      .select()
      .single();
    if (error) return { statusCode: 500, body: JSON.stringify({ error: "Could not update sale." }) };
    return { statusCode: 200, body: JSON.stringify({ sale: data }) };
  }

  if (action === "rename") {
    if (!body.saleId || !body.name || !body.name.trim()) {
      return { statusCode: 400, body: JSON.stringify({ error: "saleId and name are required." }) };
    }
    const { data, error } = await supabase
      .from("sales")
      .update({ name: body.name.trim() })
      .eq("id", body.saleId)
      .select()
      .single();
    if (error) return { statusCode: 500, body: JSON.stringify({ error: "Could not rename sale." }) };
    return { statusCode: 200, body: JSON.stringify({ sale: data }) };
  }

  if (action === "delete") {
    if (!body.saleId) return { statusCode: 400, body: JSON.stringify({ error: "saleId is required." }) };
    const { error } = await supabase.from("sales").delete().eq("id", body.saleId);
    if (error) return { statusCode: 500, body: JSON.stringify({ error: "Could not delete sale." }) };
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  }

  if (action === "duplicate") {
    if (!body.saleId) return { statusCode: 400, body: JSON.stringify({ error: "saleId is required." }) };

    const { data: sourceSale, error: sourceErr } = await supabase
      .from("sales")
      .select("id, name")
      .eq("id", body.saleId)
      .single();
    if (sourceErr || !sourceSale) return { statusCode: 404, body: JSON.stringify({ error: "Sale not found." }) };

    const newName = (body.name && body.name.trim()) || `${sourceSale.name} (Copy)`;
    let slug = slugify(newName);
    for (let i = 0; i < 5; i++) {
      const { data: existing } = await supabase.from("sales").select("id").eq("slug", slug).maybeSingle();
      if (!existing) break;
      slug = slugify(newName);
    }

    const { data: newSale, error: newSaleErr } = await supabase
      .from("sales")
      .insert({ name: newName, slug, is_active: false })
      .select()
      .single();
    if (newSaleErr) return { statusCode: 500, body: JSON.stringify({ error: "Could not create duplicate sale." }) };

    const { data: sourceProducts, error: prodErr } = await supabase
      .from("products")
      .select("name, price_cents, sort_order, colors, sizes, logos, image_data, custom_text_enabled, custom_text_label")
      .eq("sale_id", body.saleId);
    if (prodErr) return { statusCode: 500, body: JSON.stringify({ error: "Could not read products to duplicate." }) };

    if (sourceProducts && sourceProducts.length > 0) {
      const newProducts = sourceProducts.map((p) => ({ ...p, sale_id: newSale.id }));
      const { error: insertErr } = await supabase.from("products").insert(newProducts);
      if (insertErr) return { statusCode: 500, body: JSON.stringify({ error: "Sale was created, but copying its items failed." }) };
    }

    return { statusCode: 200, body: JSON.stringify({ sale: newSale }) };
  }

  return { statusCode: 400, body: JSON.stringify({ error: "Unknown action." }) };
};
