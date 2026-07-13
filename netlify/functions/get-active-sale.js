// netlify/functions/get-active-sale.js
//
// Public, read-only. Returns whichever sale is currently marked active,
// along with its products (name + price). The intake form calls this on
// load to know what's for sale right now and how much it costs.
// Returns { sale: null, products: [] } if nothing is active.

const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const { data: sale, error: saleErr } = await supabase
    .from("sales")
    .select("id, name")
    .eq("is_active", true)
    .maybeSingle();

  if (saleErr) {
    console.error("Supabase error (sales):", saleErr);
    return { statusCode: 500, body: JSON.stringify({ error: "Could not load active sale." }) };
  }

  if (!sale) {
    return { statusCode: 200, body: JSON.stringify({ sale: null, products: [] }) };
  }

  const { data: products, error: prodErr } = await supabase
    .from("products")
    .select("id, name, price_cents, colors")
    .eq("sale_id", sale.id)
    .order("sort_order", { ascending: true });

  if (prodErr) {
    console.error("Supabase error (products):", prodErr);
    return { statusCode: 500, body: JSON.stringify({ error: "Could not load products." }) };
  }

  return { statusCode: 200, body: JSON.stringify({ sale, products }) };
};
