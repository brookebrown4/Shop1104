// netlify/functions/get-product.cjs
//
// Public, read-only. A single general-catalog product for the Product
// Detail page. GET ?id=...

const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const id = event.queryStringParameters && event.queryStringParameters.id;
  if (!id) {
    return { statusCode: 400, body: JSON.stringify({ error: "id is required." }) };
  }

  const { data: p, error } = await supabase
    .from("products")
    .select("id, name, price_cents, category, portal_code, colors, sizes, sizes_enabled, threads, placements, logos, addons, image_data, hidden, sold_out")
    .eq("id", id)
    .eq("hidden", false)
    .is("sale_id", null)
    .maybeSingle();

  if (error) {
    console.error("Supabase error (get-product):", error);
    return { statusCode: 500, body: JSON.stringify({ error: "Could not load product." }) };
  }
  if (!p) {
    return { statusCode: 404, body: JSON.stringify({ error: "Product not found." }) };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      product: {
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
      },
    }),
  };
};
