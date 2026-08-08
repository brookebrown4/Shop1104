// netlify/functions/admin-orders.cjs
//
// Admin-only. Lists and edits orders for the admin "Orders & Invoices" tab.
// Gated by x-admin-code header (same ADMIN_ACCESS_CODE as the rest of the
// admin panel). Covers both general-shop orders (portal_code/no sale_id)
// and preorder-campaign orders (sale_id) -- same `orders` table either way.
//
// GET                                          -> list all orders, newest first
// POST { action: "update", orderId, fields: { status? } }
// POST { action: "delete", orderId }

const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function isAuthorized(event) {
  const code = event.headers["x-admin-code"];
  return code && process.env.ADMIN_ACCESS_CODE && code === process.env.ADMIN_ACCESS_CODE;
}

function summarizeItems(garments) {
  const counts = new Map();
  for (const g of garments || []) {
    const qty = g.qty || 1;
    counts.set(g.product_name, (counts.get(g.product_name) || 0) + qty);
  }
  return [...counts.entries()].map(([name, qty]) => `${qty} ${name}`).join(", ") || "—";
}

exports.handler = async (event) => {
  if (!isAuthorized(event)) {
    return { statusCode: 401, body: JSON.stringify({ error: "Not authorized." }) };
  }

  if (event.httpMethod === "GET") {
    const { data, error } = await supabase
      .from("orders")
      .select("id, status, customer_name, customer_email, customer_phone, garments, amount_cents, shipping_cents, fulfillment, address, notes, created_at, portal_code")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) return { statusCode: 500, body: JSON.stringify({ error: "Could not load orders." }) };

    const orders = (data || []).map((o) => ({
      id: o.id,
      shortId: o.id.slice(0, 8).toUpperCase(),
      customer: o.customer_name,
      email: o.customer_email,
      phone: o.customer_phone,
      items: summarizeItems(o.garments),
      garments: o.garments || [],
      subtotal: ((o.amount_cents || 0) / 100).toFixed(2),
      shipping: ((o.shipping_cents || 0) / 100).toFixed(2),
      total: (((o.amount_cents || 0) + (o.shipping_cents || 0)) / 100).toFixed(2),
      status: o.status,
      date: o.created_at,
      fulfillment: o.fulfillment,
      address: o.address || null,
      notes: o.notes || null,
      portalCode: o.portal_code || null,
    }));
    return { statusCode: 200, body: JSON.stringify({ orders }) };
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

  const { action } = body;

  if (action === "update") {
    const { orderId, fields } = body;
    if (!orderId || !fields) return { statusCode: 400, body: JSON.stringify({ error: "orderId and fields are required." }) };
    const updates = {};
    if (fields.status && ["Paid", "Invoiced", "Pending", "Refunded", "pending", "paid"].includes(fields.status)) {
      updates.status = fields.status;
    }
    const { data, error } = await supabase.from("orders").update(updates).eq("id", orderId).select().single();
    if (error) return { statusCode: 500, body: JSON.stringify({ error: "Could not update order." }) };
    return { statusCode: 200, body: JSON.stringify({ order: data }) };
  }

  if (action === "delete") {
    const { orderId } = body;
    if (!orderId) return { statusCode: 400, body: JSON.stringify({ error: "orderId is required." }) };
    const { error } = await supabase.from("orders").delete().eq("id", orderId);
    if (error) return { statusCode: 500, body: JSON.stringify({ error: "Could not delete order." }) };
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  }

  return { statusCode: 400, body: JSON.stringify({ error: "Unknown action." }) };
};
