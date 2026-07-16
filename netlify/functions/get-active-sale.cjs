// netlify/functions/get-active-sale.js
//
// Public, read-only. Powers the customer-facing pre-order page.
//
// GET ?slug=summer-2026-a1b2  -> that specific sale (if it's active) + its products
// GET (no slug)               -> looks at ALL currently active sales:
//     - 0 active   -> { sale: null, products: [] }
//     - 1 active   -> that sale + its products (same as before, for backward compatibility)
//     - 2+ active  -> { multipleSales: [{ slug, name }, ...] } so the page can show a picker

const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function loadProductsFor(saleId) {
  const { data: products, error } = await supabase
    .from("products")
    .select("id, name, price_cents, colors, sizes, logos, image_data")
    .eq("sale_id", saleId)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (products || []).map((p) => ({
    id: p.id,
    name: p.name,
    price_cents: p.price_cents,
    colors: p.colors || [],
    sizes: p.sizes || [],
    logos: p.logos || [],
    image: p.image_data || "",
  }));
}

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const extras = {
    taxRatePercent: Number(process.env.TAX_RATE_PERCENT || 0),
    feeRatePercent: Number(process.env.PROCESSING_FEE_PERCENT || 0),
    collectPaymentNow: process.env.COLLECT_PAYMENT_NOW !== "false",
  };

  const slug = event.queryStringParameters && event.queryStringParameters.slug;

  try {
    if (slug) {
      const { data: sale, error } = await supabase
        .from("sales")
        .select("id, name, slug, is_active")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      if (!sale || !sale.is_active) {
        return { statusCode: 200, body: JSON.stringify({ sale: null, products: [], ...extras }) };
      }
      const products = await loadProductsFor(sale.id);
      return { statusCode: 200, body: JSON.stringify({ sale: { id: sale.id, name: sale.name, slug: sale.slug }, products, ...extras }) };
    }

    // No slug given -- look at every currently active sale.
    const { data: activeSales, error } = await supabase
      .from("sales")
      .select("id, name, slug")
      .eq("is_active", true)
      .order("created_at", { ascending: false });
    if (error) throw error;

    if (!activeSales || activeSales.length === 0) {
      return { statusCode: 200, body: JSON.stringify({ sale: null, products: [], ...extras }) };
    }
    if (activeSales.length > 1) {
      return { statusCode: 200, body: JSON.stringify({ sale: null, products: [], multipleSales: activeSales, ...extras }) };
    }
    const sale = activeSales[0];
    const products = await loadProductsFor(sale.id);
    return { statusCode: 200, body: JSON.stringify({ sale, products, ...extras }) };
  } catch (err) {
    console.error("get-active-sale error:", err);
    return { statusCode: 500, body: JSON.stringify({ error: "Could not load pre-order info." }) };
  }
};
