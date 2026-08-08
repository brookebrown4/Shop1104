// netlify/functions/admin-site-content.js
//
// Admin-only. Handles all content editing for the main site: settings,
// hero, about (singleton blobs), plus gallery/threads/fonts/font
// packages/designs (list-based content). Gated by x-admin-code header,
// checked against ADMIN_ACCESS_CODE — the SAME code used for the sales
// admin panel, so there's one admin login for the whole site.
//
// Request body shape:
//   Singletons (settings/hero/about):
//     { resource: "settings", action: "update", value: {...} }
//   Lists (gallery/threads/fonts/fontPackages/designs):
//     { resource: "gallery", action: "create", fields: {...} }
//     { resource: "gallery", action: "update", id, fields: {...} }
//     { resource: "gallery", action: "delete", id }

const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function isAuthorized(event) {
  const code = event.headers["x-admin-code"];
  return code && process.env.ADMIN_ACCESS_CODE && code === process.env.ADMIN_ACCESS_CODE;
}

const SINGLETON_KEYS = new Set(["settings", "hero", "about", "shippingSettings", "catalogResources", "portalPreview"]);

// Maps each list resource to its table + how to translate the frontend's
// camelCase fields into the database's snake_case columns.
const LIST_TABLES = {
  gallery: {
    table: "gallery_items",
    toRow: (f) => ({
      label: f.label,
      bg: f.bg,
      title: f.title,
      description: f.desc,
      image_data: f.image || null,
    }),
  },
  threads: {
    table: "thread_colors",
    toRow: (f) => ({ name: f.name, code: f.code, hex: f.hex }),
  },
  fonts: {
    table: "font_styles",
    toRow: (f) => ({
      name: f.name,
      sample: f.sample,
      css_family: f.cssFamily,
      css_extra: f.cssExtra,
      description: f.desc,
    }),
  },
  fontPackages: {
    table: "font_packages",
    toRow: (f) => ({
      name: f.name,
      description: f.desc,
      resource_url: f.resourceUrl,
      resource_label: f.resourceLabel,
    }),
  },
  designs: {
    table: "design_files",
    toRow: (f) => ({ name: f.name, category: f.category, files: f.files }),
  },
  categories: {
    table: "categories",
    toRow: (f) => ({ name: f.name, allowed_colors: f.allowedColors || [] }),
  },
  colors: {
    table: "garment_colors",
    toRow: (f) => ({ name: f.name, hex: f.hex }),
  },
  placements: {
    table: "placements",
    toRow: (f) => ({ name: f.name }),
  },
  reviews: {
    table: "reviews",
    toRow: (f) => ({ name: f.name, rating: Math.min(5, Math.max(1, parseInt(f.rating, 10) || 5)), quote: f.quote }),
  },
};

exports.handler = async (event) => {
  if (!isAuthorized(event)) {
    return { statusCode: 401, body: JSON.stringify({ error: "Not authorized." }) };
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

  const { resource, action } = body;

  // ── Singletons: settings / hero / about ──
  if (SINGLETON_KEYS.has(resource)) {
    if (action !== "update" || !body.value) {
      return { statusCode: 400, body: JSON.stringify({ error: "value is required." }) };
    }
    const { error } = await supabase
  .from("site_content")
  .upsert(
    { key: resource, value: body.value, updated_at: new Date().toISOString() },
    { onConflict: "key" }
  );
    if (error) {
      console.error("Supabase error (site_content upsert):", error);
      return { statusCode: 500, body: JSON.stringify({ error: "Could not save." }) };
    }
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  }

  // ── Lists: gallery / threads / fonts / fontPackages / designs ──
  const listConfig = LIST_TABLES[resource];
  if (!listConfig) {
    return { statusCode: 400, body: JSON.stringify({ error: "Unknown resource." }) };
  }

  if (action === "create") {
    const { count } = await supabase
      .from(listConfig.table)
      .select("id", { count: "exact", head: true });
    const row = { ...listConfig.toRow(body.fields || {}), sort_order: count || 0 };
    const { data, error } = await supabase.from(listConfig.table).insert(row).select().single();
    if (error) {
      console.error(`Supabase error (${resource} create):`, error);
      return { statusCode: 500, body: JSON.stringify({ error: "Could not create item." }) };
    }
    return { statusCode: 200, body: JSON.stringify({ item: data }) };
  }

  if (action === "update") {
    if (!body.id) return { statusCode: 400, body: JSON.stringify({ error: "id is required." }) };
    const row = listConfig.toRow(body.fields || {});
    const { data, error } = await supabase
      .from(listConfig.table)
      .update(row)
      .eq("id", body.id)
      .select()
      .single();
    if (error) {
      console.error(`Supabase error (${resource} update):`, error);
      return { statusCode: 500, body: JSON.stringify({ error: "Could not update item." }) };
    }
    return { statusCode: 200, body: JSON.stringify({ item: data }) };
  }

  if (action === "delete") {
    if (!body.id) return { statusCode: 400, body: JSON.stringify({ error: "id is required." }) };
    const { error } = await supabase.from(listConfig.table).delete().eq("id", body.id);
    if (error) {
      console.error(`Supabase error (${resource} delete):`, error);
      return { statusCode: 500, body: JSON.stringify({ error: "Could not delete item." }) };
    }
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  }

  return { statusCode: 400, body: JSON.stringify({ error: "Unknown action." }) };
};
