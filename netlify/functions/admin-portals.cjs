// netlify/functions/admin-portals.js
//
// Admin-only. Manages client portals and their products. Gated by
// x-admin-code header (same ADMIN_ACCESS_CODE as the rest of the admin panel).
//
// GET                                    -> list all portals (with products)
// POST { action: "createPortal", name }
// POST { action: "updatePortal", code, fields: { name, lockDate, stripeLink, hidden } }
// POST { action: "deletePortal", code }
// POST { action: "createProduct", portalCode, fields: {...} }
// POST { action: "updateProduct", id, fields: {...} }
// POST { action: "deleteProduct", id }

const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function isAuthorized(event) {
  const code = event.headers["x-admin-code"];
  return code && process.env.ADMIN_ACCESS_CODE && code === process.env.ADMIN_ACCESS_CODE;
}

function genCode(name) {
  const base = (name || "").replace(/\s/g, "").slice(0, 4).toUpperCase();
  return (base + Math.floor(10 + Math.random() * 90)).slice(0, 7);
}

function productToRow(f, portalCode) {
  return {
    portal_code: portalCode,
    label: f.label,
    bg: f.bg,
    brand: f.brand,
    title: f.title,
    price_display: f.price,
    base_price: f.basePrice ? parseFloat(f.basePrice) : null,
    description: f.desc,
    image_data: f.image || null,
    placements: f.placements || [],
    sizes: f.sizes || [],
  };
}

exports.handler = async (event) => {
  if (!isAuthorized(event)) {
    return { statusCode: 401, body: JSON.stringify({ error: "Not authorized." }) };
  }

  if (event.httpMethod === "GET") {
    const { data: portals, error: portalErr } = await supabase
      .from("client_portals")
      .select("*")
      .order("created_at", { ascending: false });
    if (portalErr) return { statusCode: 500, body: JSON.stringify({ error: "Could not load portals." }) };

    const { data: products, error: prodErr } = await supabase.from("client_portal_products").select("*");
    if (prodErr) return { statusCode: 500, body: JSON.stringify({ error: "Could not load products." }) };

    const portalsOut = (portals || []).map((p) => ({
      code: p.code,
      name: p.name,
      lockDate: p.lock_date,
      stripeLink: p.stripe_link,
      passwordEnabled: !!p.password_enabled,
      hidden: !!p.hidden,
      products: (products || [])
        .filter((prod) => prod.portal_code === p.code)
        .map((prod) => ({
          id: prod.id,
          label: prod.label,
          bg: prod.bg,
          brand: prod.brand,
          title: prod.title,
          price: prod.price_display,
          basePrice: prod.base_price,
          desc: prod.description,
          image: prod.image_data || "",
          placements: prod.placements || [],
          sizes: prod.sizes || [],
        })),
    }));

    return { statusCode: 200, body: JSON.stringify({ portals: portalsOut }) };
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

  if (action === "createPortal") {
    if (!body.name) return { statusCode: 400, body: JSON.stringify({ error: "name is required." }) };
    if (!body.code) {
      let code = genCode(body.name);
      for (let i = 0; i < 5; i++) {
        const { data: existing } = await supabase.from("client_portals").select("code").eq("code", code).maybeSingle();
        if (!existing) break;
        code = genCode(body.name);
      }
      body.code = code;
    }
    const passwordEnabled = !!body.passwordEnabled;
    const { data, error } = await supabase
      .from("client_portals")
      .insert({
        code: body.code.trim().toUpperCase(),
        name: body.name,
        password_enabled: passwordEnabled,
        password: passwordEnabled ? body.password || "" : null,
      })
      .select()
      .single();
    if (error) return { statusCode: 500, body: JSON.stringify({ error: "Could not create portal." }) };
    return { statusCode: 200, body: JSON.stringify({ portal: data }) };
  }

  if (action === "updatePortal") {
    if (!body.code) return { statusCode: 400, body: JSON.stringify({ error: "code is required." }) };
    const f = body.fields || {};
    const updates = {};
    if (f.name) updates.name = f.name;
    if ("lockDate" in f) updates.lock_date = f.lockDate || null;
    if ("stripeLink" in f) updates.stripe_link = f.stripeLink || null;
    if ("passwordEnabled" in f) updates.password_enabled = !!f.passwordEnabled;
    if ("password" in f) updates.password = f.password || null;
    if ("hidden" in f) updates.hidden = !!f.hidden;
    const { data, error } = await supabase
      .from("client_portals")
      .update(updates)
      .eq("code", body.code)
      .select()
      .single();
    if (error) return { statusCode: 500, body: JSON.stringify({ error: "Could not update portal." }) };
    return { statusCode: 200, body: JSON.stringify({ portal: data }) };
  }

  if (action === "deletePortal") {
    if (!body.code) return { statusCode: 400, body: JSON.stringify({ error: "code is required." }) };
    const { error } = await supabase.from("client_portals").delete().eq("code", body.code);
    if (error) return { statusCode: 500, body: JSON.stringify({ error: "Could not delete portal." }) };
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  }

  if (action === "createProduct") {
    if (!body.portalCode || !body.fields || !body.fields.title) {
      return { statusCode: 400, body: JSON.stringify({ error: "portalCode and fields.title are required." }) };
    }
    const row = productToRow(body.fields, body.portalCode);
    const { data, error } = await supabase.from("client_portal_products").insert(row).select().single();
    if (error) return { statusCode: 500, body: JSON.stringify({ error: "Could not create product." }) };
    return { statusCode: 200, body: JSON.stringify({ product: data }) };
  }

  if (action === "updateProduct") {
    if (!body.id) return { statusCode: 400, body: JSON.stringify({ error: "id is required." }) };
    const { data: existing, error: findErr } = await supabase
      .from("client_portal_products")
      .select("portal_code")
      .eq("id", body.id)
      .single();
    if (findErr || !existing) return { statusCode: 404, body: JSON.stringify({ error: "Product not found." }) };
    const row = productToRow(body.fields || {}, existing.portal_code);
    delete row.portal_code; // don't allow moving products between portals via update
    const { data, error } = await supabase
      .from("client_portal_products")
      .update(row)
      .eq("id", body.id)
      .select()
      .single();
    if (error) return { statusCode: 500, body: JSON.stringify({ error: "Could not update product." }) };
    return { statusCode: 200, body: JSON.stringify({ product: data }) };
  }

  if (action === "deleteProduct") {
    if (!body.id) return { statusCode: 400, body: JSON.stringify({ error: "id is required." }) };
    const { error } = await supabase.from("client_portal_products").delete().eq("id", body.id);
    if (error) return { statusCode: 500, body: JSON.stringify({ error: "Could not delete product." }) };
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  }

  return { statusCode: 400, body: JSON.stringify({ error: "Unknown action." }) };
};
