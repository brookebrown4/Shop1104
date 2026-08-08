// netlify/functions/get-portal.js
//
// Public. Given a client access code (and password, if that portal requires
// one), returns that ONE portal and its products — never the full list of
// portals (that stays admin-only, so one client can never see another
// client's pricing). The password is verified here, server-side; it is
// never sent back to the browser.
// GET ?code=ACME&password=acme2026

const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const params = event.queryStringParameters || {};
  const code = (params.code || "").trim().toUpperCase();
  const password = params.password || "";
  if (!code) {
    return { statusCode: 400, body: JSON.stringify({ error: "code is required." }) };
  }

  const { data: portal, error: portalErr } = await supabase
    .from("client_portals")
    .select("code, name, lock_date, stripe_link, password, password_enabled, hidden")
    .eq("code", code)
    .maybeSingle();

  if (portalErr) {
    console.error("Supabase error (get-portal):", portalErr);
    return { statusCode: 500, body: JSON.stringify({ error: "Could not look up portal." }) };
  }
  // A hidden portal responds exactly like a code that never existed --
  // deliberately not "closed", so it can't be distinguished/enumerated
  // from a typo'd code.
  if (!portal || portal.hidden) {
    return { statusCode: 200, body: JSON.stringify({ portal: null, products: [], error: "No store found for that code." }) };
  }
  if (portal.password_enabled && password !== portal.password) {
    return { statusCode: 200, body: JSON.stringify({ portal: null, products: [], error: "Incorrect password." }) };
  }
  // A closed-but-visible portal tells the customer when it closed, rather
  // than silently pretending not to exist (that's what "hidden" is for).
  if (portal.lock_date && new Date(portal.lock_date + "T00:00:00") <= new Date()) {
    return { statusCode: 200, body: JSON.stringify({ portal: null, products: [], error: `This store closed on ${portal.lock_date}.` }) };
  }

  const { data: products, error: prodErr } = await supabase
    .from("products")
    .select("id, name, price_cents, category, colors, sizes, sizes_enabled, threads, placements, logos, addons, image_data, hidden, sold_out, sort_order")
    .eq("portal_code", code)
    .eq("hidden", false)
    .is("sale_id", null)
    .order("sort_order", { ascending: true });

  if (prodErr) {
    console.error("Supabase error (get-portal products):", prodErr);
    return { statusCode: 500, body: JSON.stringify({ error: "Could not load products." }) };
  }

  const mappedProducts = (products || []).map((p) => ({
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

  return {
    statusCode: 200,
    body: JSON.stringify({
      portal: { code: portal.code, name: portal.name, lockDate: portal.lock_date, stripeLink: portal.stripe_link },
      products: mappedProducts,
    }),
  };
};
