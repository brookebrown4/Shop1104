// netlify/functions/get-portal.js
//
// Public. Given a client access code, returns that ONE portal and its
// products — never the full list of portals (that stays admin-only, so
// one client can never see another client's pricing).
// GET ?code=SHOP24

const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const code = (event.queryStringParameters && event.queryStringParameters.code || "").trim().toUpperCase();
  if (!code) {
    return { statusCode: 400, body: JSON.stringify({ error: "code is required." }) };
  }

  const { data: portal, error: portalErr } = await supabase
    .from("client_portals")
    .select("code, name, lock_date, stripe_link")
    .eq("code", code)
    .maybeSingle();

  if (portalErr) {
    console.error("Supabase error (get-portal):", portalErr);
    return { statusCode: 500, body: JSON.stringify({ error: "Could not look up portal." }) };
  }
  if (!portal) {
    return { statusCode: 200, body: JSON.stringify({ portal: null, products: [] }) };
  }

  const { data: products, error: prodErr } = await supabase
    .from("client_portal_products")
    .select("*")
    .eq("portal_code", code)
    .order("sort_order", { ascending: true });

  if (prodErr) {
    console.error("Supabase error (get-portal products):", prodErr);
    return { statusCode: 500, body: JSON.stringify({ error: "Could not load products." }) };
  }

  const mappedProducts = (products || []).map((p) => ({
    id: p.id,
    label: p.label,
    bg: p.bg,
    brand: p.brand,
    title: p.title,
    price: p.price_display,
    basePrice: p.base_price,
    desc: p.description,
    image: p.image_data || "",
    placements: p.placements || [],
    sizes: p.sizes || [],
  }));

  return {
    statusCode: 200,
    body: JSON.stringify({
      portal: { code: portal.code, name: portal.name, lockDate: portal.lock_date, stripeLink: portal.stripe_link },
      products: mappedProducts,
    }),
  };
};
