// netlify/functions/admin-products.js
//
// Admin-only. Dual-purpose: manages the general catalog (Main Shop/client
// portal products, filtered by `store`/`portalCode`, used by Admin.jsx's
// Products tab) and, for the now-retired preorder-campaign flow's leftover
// data, sale-scoped products (filtered by `saleId`). Gated by the same
// x-admin-code header as the rest of the admin panel.
//
// Each product can define its own:
//   - sizes:  [{ name, extraCost }]      -- hidden entirely from customers if sizesEnabled is false
//   - colors: [{ name, extraCost, hex }] -- if empty, customer can type any color
//   - logos:  [{ name, extraCost }]      -- if empty, no logo/design choice is shown
//   - customTextFields: [{ label }]      -- as many labeled text boxes as this item needs
//   - image: a base64 photo (optional)
// extraCost is added on top of the base price when a customer picks that option.
//
// GET  ?saleId=...  -> list products for a sale
// POST { action: "create", saleId, name, priceCents, sizes?, sizesEnabled?, colors?, logos?, image?, customTextFields? }
// POST { action: "update", productId, name, priceCents, sizes?, sizesEnabled?, colors?, logos?, image?, customTextFields? }
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
    .map((o) => ({
      name: o.name.trim(),
      extraCost: Number.isFinite(Number(o.extraCost)) ? Math.round(Number(o.extraCost) * 100) : 0,
      ...(o.hex ? { hex: o.hex } : {}),
    }));
}

function cleanTextFields(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((f) => f && f.label && f.label.trim())
    .map((f) => ({ label: f.label.trim() }));
}

function cleanNameList(list) {
  if (!Array.isArray(list)) return [];
  return list.filter((n) => typeof n === "string" && n.trim()).map((n) => n.trim());
}

function cleanAddons(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((a) => a && a.name && a.name.trim())
    .map((a) => ({
      name: a.name.trim(),
      extraCost: Number.isFinite(Number(a.extraCost ?? a.price)) ? Math.round(Number(a.extraCost ?? a.price) * 100) : 0,
    }));
}

exports.handler = async (event) => {
  if (!isAuthorized(event)) {
    return { statusCode: 401, body: JSON.stringify({ error: "Not authorized." }) };
  }

  if (event.httpMethod === "GET") {
    const q = event.queryStringParameters || {};

    // General catalog listing for the Products admin tab: ?store=all (every
    // store), ?store= (Main Shop only, portal_code null), or ?store=CODE
    // (one client portal). Distinct from the saleId path below, which is
    // the preorder-campaign product list.
    if ("store" in q) {
      let query = supabase
        .from("products")
        .select("id, name, price_cents, category, portal_code, hidden, sold_out, sort_order, colors, sizes, sizes_enabled, threads, placements, logos, addons, image_data")
        // This tab manages the general catalog only -- preorder-campaign
        // products (sale_id set) stay in the separate Sales admin panel,
        // even under "All stores", so they can't be edited/hidden from
        // the wrong UI.
        .is("sale_id", null)
        .order("sort_order", { ascending: true });
      if (q.store === "all") {
        // no filter
      } else if (q.store) {
        query = query.eq("portal_code", q.store.toUpperCase());
      } else {
        query = query.is("portal_code", null);
      }
      const { data, error } = await query;
      if (error) return { statusCode: 500, body: JSON.stringify({ error: "Could not load products." }) };
      return { statusCode: 200, body: JSON.stringify({ products: data }) };
    }

    const saleId = q.saleId;
    if (!saleId) return { statusCode: 400, body: JSON.stringify({ error: "saleId or store query param is required." }) };

    const { data, error } = await supabase
      .from("products")
      .select("id, name, price_cents, sort_order, colors, sizes, logos, image_data, sizes_enabled, custom_text_fields")
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
    // General-catalog products (Main Shop or a client portal) omit saleId
    // and pass portalCode ('' means Main Shop) instead.
    const { saleId, portalCode, name, priceCents } = body;
    if (!name || !name.trim() || !Number.isFinite(priceCents)) {
      return { statusCode: 400, body: JSON.stringify({ error: "name and priceCents are required." }) };
    }
    if (saleId === undefined && portalCode === undefined) {
      return { statusCode: 400, body: JSON.stringify({ error: "saleId or portalCode is required." }) };
    }

    const { data, error } = await supabase
      .from("products")
      .insert({
        sale_id: saleId || null,
        portal_code: portalCode ? portalCode.trim().toUpperCase() : null,
        category: body.category || null,
        hidden: !!body.hidden,
        sold_out: !!body.soldOut,
        name: name.trim(),
        price_cents: Math.round(priceCents),
        colors: cleanOptionList(body.colors),
        sizes: cleanOptionList(body.sizes),
        sizes_enabled: body.sizesEnabled !== false,
        threads: cleanNameList(body.threads),
        placements: cleanNameList(body.placements),
        addons: cleanAddons(body.addons),
        logos: cleanOptionList(body.logos),
        image_data: body.image || null,
        custom_text_fields: cleanTextFields(body.customTextFields),
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
    if (body.category !== undefined) updates.category = body.category || null;
    if (body.portalCode !== undefined) updates.portal_code = body.portalCode ? body.portalCode.trim().toUpperCase() : null;
    if (body.hidden !== undefined) updates.hidden = !!body.hidden;
    if (body.soldOut !== undefined) updates.sold_out = !!body.soldOut;
    if (body.colors !== undefined) updates.colors = cleanOptionList(body.colors);
    if (body.sizes !== undefined) updates.sizes = cleanOptionList(body.sizes);
    if (body.sizesEnabled !== undefined) updates.sizes_enabled = !!body.sizesEnabled;
    if (body.threads !== undefined) updates.threads = cleanNameList(body.threads);
    if (body.placements !== undefined) updates.placements = cleanNameList(body.placements);
    if (body.addons !== undefined) updates.addons = cleanAddons(body.addons);
    if (body.logos !== undefined) updates.logos = cleanOptionList(body.logos);
    if (body.image !== undefined) updates.image_data = body.image || null;
    if (body.customTextFields !== undefined) updates.custom_text_fields = cleanTextFields(body.customTextFields);

    const { data, error } = await supabase
      .from("products")
      .update(updates)
      .eq("id", productId)
      .select()
      .single();

    if (error) return { statusCode: 500, body: JSON.stringify({ error: "Could not update product." }) };
    return { statusCode: 200, body: JSON.stringify({ product: data }) };
  }

  if (action === "move") {
    const { productId, targetSaleId } = body;
    if (!productId || !targetSaleId) {
      return { statusCode: 400, body: JSON.stringify({ error: "productId and targetSaleId are required." }) };
    }
    const { data, error } = await supabase
      .from("products")
      .update({ sale_id: targetSaleId })
      .eq("id", productId)
      .select()
      .single();

    if (error) return { statusCode: 500, body: JSON.stringify({ error: "Could not move product." }) };
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
