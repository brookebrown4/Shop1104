// netlify/functions/submit-general-order.cjs
//
// Saves an incoming general-shop cart (multiple different products, each
// with its own customization) to Supabase with status "pending", before
// the customer is sent to Stripe. Mirrors submit-order.cjs's rule: the
// browser only ever sends product IDs, picked option names, and
// quantities -- prices, sizes, colors, threads, placements, designs and
// add-on costs are all looked up and validated server-side, so nothing
// about the charge can be tampered with client-side.
//
// POST {
//   name, email, phone, portalCode?, fulfillment, address?, notes?,
//   items: [{ productId, qty, size?, color?, thread?, placement?, design?,
//             personalize?, addons?: [name,...] }]
// }

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

  const { name, email, phone, fulfillment, address, notes, items } = order || {};
  const portalCode = (order && order.portalCode || "").trim().toUpperCase() || null;

  if (!name || !email || !phone || !Array.isArray(items) || items.length === 0) {
    return { statusCode: 400, body: JSON.stringify({ error: "Missing required order fields." }) };
  }
  if (fulfillment === "ship" && (!address || !address.street || !address.city || !address.state || !address.zip)) {
    return { statusCode: 400, body: JSON.stringify({ error: "A complete shipping address is required." }) };
  }

  // Look up real prices and option lists for the selected products -- never
  // trust prices or option costs sent from the client.
  const productIds = [...new Set(items.map((i) => i.productId))];
  let productQuery = supabase
    .from("products")
    .select("id, name, price_cents, colors, sizes, sizes_enabled, threads, placements, logos, addons, hidden, sold_out")
    .in("id", productIds)
    .is("sale_id", null);
  productQuery = portalCode ? productQuery.eq("portal_code", portalCode) : productQuery.is("portal_code", null);

  const { data: products, error: prodErr } = await productQuery;
  if (prodErr) {
    console.error("Supabase error (products lookup):", prodErr);
    return { statusCode: 500, body: JSON.stringify({ error: "Could not price order." }) };
  }

  const productMap = new Map(products.map((p) => [p.id, p]));
  let amountCents = 0;
  let itemCount = 0;
  const enrichedGarments = [];

  for (const item of items) {
    const product = productMap.get(item.productId);
    if (!product || product.hidden || product.sold_out) {
      return { statusCode: 400, body: JSON.stringify({ error: "One or more items are no longer available." }) };
    }

    const qty = Number.isInteger(item.qty) && item.qty > 0 ? item.qty : 1;
    const sizeList = product.sizes || [];
    const colorList = product.colors || [];
    const threadList = product.threads || [];
    const placementList = product.placements || [];
    const designList = product.logos || [];
    const addonList = product.addons || [];
    const sizeRequired = product.sizes_enabled !== false && sizeList.length > 0;

    if (sizeRequired && !item.size) {
      return { statusCode: 400, body: JSON.stringify({ error: `Choose a size for ${product.name}.` }) };
    }
    if (sizeRequired && !sizeList.some((s) => s.name === item.size)) {
      return { statusCode: 400, body: JSON.stringify({ error: `"${item.size}" isn't an available size for ${product.name}.` }) };
    }
    if (colorList.length > 0 && item.color && !colorList.some((c) => c.name === item.color)) {
      return { statusCode: 400, body: JSON.stringify({ error: `"${item.color}" isn't an available color for ${product.name}.` }) };
    }
    if (threadList.length > 0 && item.thread && !threadList.includes(item.thread)) {
      return { statusCode: 400, body: JSON.stringify({ error: `"${item.thread}" isn't an available thread color for ${product.name}.` }) };
    }
    if (placementList.length > 0 && item.placement && !placementList.includes(item.placement)) {
      return { statusCode: 400, body: JSON.stringify({ error: `"${item.placement}" isn't an available placement for ${product.name}.` }) };
    }
    if (designList.length > 0 && item.design && !designList.some((d) => d.name === item.design)) {
      return { statusCode: 400, body: JSON.stringify({ error: `"${item.design}" isn't an available design for ${product.name}.` }) };
    }

    const chosenAddons = Array.isArray(item.addons)
      ? addonList.filter((a) => item.addons.includes(a.name))
      : [];

    const size = sizeList.find((s) => s.name === item.size);
    const color = colorList.find((c) => c.name === item.color);
    const design = designList.find((d) => d.name === item.design);
    const addonCents = chosenAddons.reduce((sum, a) => sum + (a.extraCost || 0), 0);
    const unitCents = product.price_cents + (size?.extraCost || 0) + (color?.extraCost || 0) + (design?.extraCost || 0) + addonCents;
    amountCents += unitCents * qty;
    itemCount += qty;

    enrichedGarments.push({
      product_id: product.id,
      product_name: product.name,
      price_cents: unitCents,
      qty,
      color: item.color || null,
      size: item.size || null,
      thread: item.thread || null,
      placement: item.placement || null,
      design: item.design || null,
      addons: chosenAddons.map((a) => a.name),
      personalize: (item.personalize || "").trim() || null,
      notes: (item.notes || "").trim() || null,
    });
  }

  // Shipping is computed server-side from the admin-configured formula in
  // site_content (base + perItem x itemCount, waived above the free
  // threshold), never trusted from the client. Local pickup is always $0.
  let shippingCents = 0;
  if (fulfillment !== "pickup") {
    const { data: shipRow } = await supabase.from("site_content").select("value").eq("key", "shippingSettings").maybeSingle();
    const ship = (shipRow && shipRow.value) || { base: 0, perItem: 0, freeThreshold: 0 };
    const freeThresholdCents = Math.round((ship.freeThreshold || 0) * 100);
    if (!(freeThresholdCents > 0 && amountCents >= freeThresholdCents)) {
      shippingCents = Math.round((ship.base || 0) * 100) + Math.round((ship.perItem || 0) * 100) * itemCount;
    }
  }

  const { data, error } = await supabase
    .from("orders")
    .insert({
      status: "pending",
      portal_code: portalCode,
      customer_name: name,
      customer_email: email,
      customer_phone: phone,
      garments: enrichedGarments,
      fulfillment,
      address: fulfillment === "ship" ? address : null,
      amount_cents: amountCents,
      shipping_cents: shippingCents,
      notes: notes || null,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Supabase insert error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: "Could not save order." }) };
  }

  return { statusCode: 200, body: JSON.stringify({ orderId: data.id, amountCents, shippingCents }) };
};
