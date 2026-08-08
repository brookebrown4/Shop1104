// netlify/functions/get-products.cjs
//
// Public, read-only. Powers the general storefront (Home/Shop/Product pages)
// and client portals -- same `products` table as the preorder-campaign
// flow, just filtered by portal_code instead of sale_id.
//
// GET                     -> main shop: all non-hidden products with no portal_code
// GET ?portalCode=ACME    -> that portal's non-hidden products

const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const portalCode = (event.queryStringParameters && event.queryStringParameters.portalCode || "").trim().toUpperCase();

  let query = supabase
    .from("products")
    .select("id, name, price_cents, category, portal_code, colors, sizes, sizes_enabled, threads, placements, logos, addons, image_data, hidden, sold_out, sort_order")
    .eq("hidden", false)
    // Preorder-campaign products (sale_id set) are a separate flow, not
    // part of the general catalog, even though they share this table.
    .is("sale_id", null)
    .order("sort_order", { ascending: true });

  query = portalCode ? query.eq("portal_code", portalCode) : query.is("portal_code", null);

  const { data, error } = await query;
  if (error) {
    console.error("Supabase error (get-products):", error);
    return { statusCode: 500, body: JSON.stringify({ error: "Could not load products." }) };
  }

  const products = (data || []).map((p) => ({
    id: p.id,
    name: p.name,
    price_cents: p.price_cents,
    category: p.category || "",
    colors: p.colors || [],
    sizes: p.sizes || [],
    sizesEnabled: p.sizes_enabled !== false,
    threads: p.threads || [],
    placements: p.placements || [],
    designs: p.logos || [],
    addons: p.addons || [],
    image: p.image_data || "",
    soldOut: !!p.sold_out,
  }));

  return { statusCode: 200, body: JSON.stringify({ products }) };
};
