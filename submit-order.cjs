// netlify/functions/submit-order.cjs
//
// Saves an incoming pre-order to Supabase with status "pending", before
// the customer is sent to Stripe to pay. Prices, sizes, colors, and logo
// choices are all looked up and validated server-side from the active
// sale's products -- the browser only ever sends product IDs and picked
// option names, never prices, so nothing about the charge can be
// tampered with client-side.

const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  let order;
  try {
    order = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON body." }) };
  }

  const { name, email, phone, saleId, garments, fulfillment, address, notes } = order || {};

  if (!name || !email || !phone || !saleId || !Array.isArray(garments) || garments.length === 0) {
    return { statusCode: 400, body: JSON.stringify({ error: "Missing required order fields." }) };
  }

  // Confirm this is really the active sale -- prevents someone submitting
  // against a sale that's since been deactivated or changed.
  const { data: sale, error: saleErr } = await supabase
    .from("sales")
    .select("id")
    .eq("id", saleId)
    .eq("is_active", true)
    .maybeSingle();

  if (saleErr) {
    console.error("Supabase error (sale check):", saleErr);
    return { statusCode: 500, body: JSON.stringify({ error: "Could not verify sale." }) };
  }
  if (!sale) {
    return { statusCode: 400, body: JSON.stringify({ error: "This sale is no longer active." }) };
  }

  // Look up real prices and option lists for the selected products -- never
  // trust prices, sizes, colors, or logos sent from the client.
  const productIds = [...new Set(garments.map((g) => g.productId))];
  const { data: products, error: prodErr } = await supabase
    .from("products")
    .select("id, name, price_cents, colors, sizes, logos, sizes_enabled, custom_text_fields")
    .eq("sale_id", saleId)
    .in("id", productIds);

  if (prodErr) {
    console.error("Supabase error (products lookup):", prodErr);
    return { statusCode: 500, body: JSON.stringify({ error: "Could not price order." }) };
  }

  const productMap = new Map(products.map((p) => [p.id, p]));
  let amountCents = 0;
  const enrichedGarments = [];

  for (const g of garments) {
    const product = productMap.get(g.productId);
    if (!product) {
      return { statusCode: 400, body: JSON.stringify({ error: "One or more items are no longer available." }) };
    }

    const sizeList = product.sizes || [];
    const colorList = product.colors || [];
    const logoList = product.logos || [];
    const sizeRequired = product.sizes_enabled !== false;

    if (sizeRequired && !g.size) {
      return { statusCode: 400, body: JSON.stringify({ error: `Choose a size for ${product.name}.` }) };
    }
    if (!g.color || !g.color.trim()) {
      return { statusCode: 400, body: JSON.stringify({ error: `Choose a color for ${product.name}.` }) };
    }
    if (sizeRequired && sizeList.length > 0 && !sizeList.some((s) => s.name === g.size)) {
      return { statusCode: 400, body: JSON.stringify({ error: `"${g.size}" isn't an available size for ${product.name}.` }) };
    }
    // Colors are stored as [{ name, extraCost, hex }], so we check against
    // the names -- comparing the raw array against a string always failed
    // here before, which silently rejected valid orders.
    if (colorList.length > 0 && !colorList.some((c) => c.name === g.color)) {
      return { statusCode: 400, body: JSON.stringify({ error: `"${g.color}" isn't an available color for ${product.name}.` }) };
    }
    if (g.logo && logoList.length > 0 && !logoList.some((l) => l.name === g.logo)) {
      return { statusCode: 400, body: JSON.stringify({ error: `"${g.logo}" isn't an available design for ${product.name}.` }) };
    }

    // Add up base price + any extra cost from the size, color, and logo
    // picked -- this used to only charge the base price, undercharging
    // for every upcharged option.
    const size = sizeList.find((s) => s.name === g.size);
    const color = colorList.find((c) => c.name === g.color);
    const logo = logoList.find((l) => l.name === g.logo);
    const lineCents = product.price_cents + (size?.extraCost || 0) + (color?.extraCost || 0) + (logo?.extraCost || 0);
    amountCents += lineCents;

    enrichedGarments.push({
      product_id: product.id,
      product_name: product.name,
      price_cents: lineCents,
      color: g.color.trim(),
      size: g.size || null,
      // Logo/design choice used to be dropped entirely here -- now saved.
      logo: g.logo || null,
      custom_text_answers: g.customTextAnswers || {},
    });
  }

  const { data, error } = await supabase
    .from("orders")
    .insert({
      status: "pending",
      sale_id: saleId,
      customer_name: name,
      customer_email: email,
      customer_phone: phone,
      garments: enrichedGarments,
      fulfillment,
      address: fulfillment === "ship" ? address : null,
      amount_cents: amountCents,
      notes: notes || null,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Supabase insert error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: "Could not save order." }) };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ orderId: data.id, amountCents }),
  };
};
