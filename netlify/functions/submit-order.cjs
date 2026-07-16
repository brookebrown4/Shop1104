// netlify/functions/submit-order.js
//
// Saves an incoming pre-order to Supabase with status "pending", before
// the customer is sent to Stripe to pay. Prices are looked up and computed
// server-side from the active sale's products -- the browser only ever
// sends which options were picked (size/color/logo names), never prices,
// so nothing about the charge can be tampered with client-side.
//
// Per-garment price = product's base price
//                    + that size's extraCost (if the product defines sizes)
//                    + that color's extraCost (if the product defines colors)
//                    + that logo's extraCost (if the product defines logos)

const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Looks up the extraCost for a chosen option name within a product's option
// list. If the product doesn't define any options for this dimension, the
// choice is optional and contributes no extra cost. Returns null if the
// product DOES define options but the chosen one isn't among them (invalid).
function resolveOption(optionList, chosenName) {
  if (!Array.isArray(optionList) || optionList.length === 0) {
    return { required: false, valid: true, extraCost: 0 };
  }
  const match = optionList.find((o) => o.name === chosenName);
  if (!match) return { required: true, valid: false, extraCost: 0 };
  return { required: true, valid: true, extraCost: match.extraCost || 0 };
}

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

  const { name, email, phone, saleId, garments, fulfillment, address } = order || {};

  if (!name || !email || !phone || !saleId || !Array.isArray(garments) || garments.length === 0) {
    return { statusCode: 400, body: JSON.stringify({ error: "Missing required order fields." }) };
  }

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

  const productIds = [...new Set(garments.map((g) => g.productId))];
  const { data: products, error: prodErr } = await supabase
    .from("products")
    .select("id, name, price_cents, colors, sizes, logos, custom_text_enabled, custom_text_label")
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
    if (!g.size) {
      return { statusCode: 400, body: JSON.stringify({ error: `Please choose a size for ${product.name}.` }) };
    }

    const sizeResult = resolveOption(product.sizes, g.size);
    if (!sizeResult.valid) {
      return { statusCode: 400, body: JSON.stringify({ error: `"${g.size}" isn't an available size for ${product.name}.` }) };
    }

    const colorOptions = product.colors || [];
    if (colorOptions.length > 0 && !g.color) {
      return { statusCode: 400, body: JSON.stringify({ error: `Please choose a color for ${product.name}.` }) };
    }
    const colorResult = resolveOption(product.colors, g.color);
    if (!colorResult.valid) {
      return { statusCode: 400, body: JSON.stringify({ error: `"${g.color}" isn't an available color for ${product.name}.` }) };
    }

    const logoOptions = product.logos || [];
    if (logoOptions.length > 0 && !g.logo) {
      return { statusCode: 400, body: JSON.stringify({ error: `Please choose a logo/design for ${product.name}.` }) };
    }
    const logoResult = resolveOption(product.logos, g.logo);
    if (!logoResult.valid) {
      return { statusCode: 400, body: JSON.stringify({ error: `"${g.logo}" isn't an available logo for ${product.name}.` }) };
    }

    if (product.custom_text_enabled && (!g.customText || !g.customText.trim())) {
      return { statusCode: 400, body: JSON.stringify({ error: `Please fill in "${product.custom_text_label || "Custom Name"}" for ${product.name}.` }) };
    }

    const finalPriceCents = product.price_cents + sizeResult.extraCost + colorResult.extraCost + logoResult.extraCost;
    amountCents += finalPriceCents;
    enrichedGarments.push({
      product_id: product.id,
      product_name: product.name,
      price_cents: finalPriceCents,
      color: g.color ? g.color.trim() : "",
      size: g.size,
      logo: g.logo ? g.logo.trim() : "",
      custom_text: product.custom_text_enabled && g.customText ? g.customText.trim() : "",
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
