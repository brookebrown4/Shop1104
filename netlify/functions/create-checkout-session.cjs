// netlify/functions/create-checkout-session.js
//
// Creates a Stripe Checkout Session for a previously-saved, already-priced
// order. Reads the order straight from Supabase (never trusts an amount
// passed in from the browser) and builds one Stripe line item per distinct
// product so the customer's receipt itemizes what they bought.

const Stripe = require("stripe");
const { createClient } = require("@supabase/supabase-js");

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON body." }) };
  }

  const { orderId } = body || {};
  if (!orderId) {
    return { statusCode: 400, body: JSON.stringify({ error: "orderId is required." }) };
  }

  const { data: order, error } = await supabase
    .from("orders")
    .select("id, customer_email, garments, status, shipping_cents, sale_id")
    .eq("id", orderId)
    .single();

  if (error || !order) {
    return { statusCode: 404, body: JSON.stringify({ error: "Order not found." }) };
  }
  if (order.status !== "pending") {
    return { statusCode: 400, body: JSON.stringify({ error: "This order has already been processed." }) };
  }

  // Group garments by product so identical items become one line item
  // with a quantity, rather than N separate lines. `qty` is only present
  // on general-shop orders (submit-general-order.cjs); preorder-campaign
  // orders (submit-order.cjs) list one entry per unit, so it defaults to 1.
  const grouped = new Map();
  for (const g of order.garments) {
    const key = `${g.product_id}:${g.price_cents}`;
    if (!grouped.has(key)) {
      grouped.set(key, { name: g.product_name, unit_amount: g.price_cents, quantity: 0 });
    }
    grouped.get(key).quantity += g.qty || 1;
  }

  // Built from the actual request the browser made, not Netlify's build-time
  // URL/DEPLOY_PRIME_URL vars -- those aren't reliably visible to Functions
  // at invocation time and process.env.URL always resolves to the
  // PRODUCTION domain regardless of context, which was sending
  // previewed/staged checkouts back to the live site after payment instead
  // of the environment actually being tested. The Host header always
  // matches whatever domain the request really came through.
  const forwardedHost = event.headers["x-forwarded-host"] || event.headers.host;
  const forwardedProto = event.headers["x-forwarded-proto"] || (forwardedHost && forwardedHost.startsWith("localhost") ? "http" : "https");
  const siteUrl = forwardedHost ? `${forwardedProto}://${forwardedHost}` : process.env.URL || "http://localhost:8888";
  const cancelPath = order.sale_id ? "/preorder?cancelled=true" : "/cart?cancelled=true";

  const taxRatePercent = Number(process.env.TAX_RATE_PERCENT || 0);
  const feeRatePercent = Number(process.env.PROCESSING_FEE_PERCENT || 0);
  const subtotalCents = [...grouped.values()].reduce((sum, item) => sum + item.unit_amount * item.quantity, 0);
  const taxCents = Math.round((subtotalCents * taxRatePercent) / 100);
  const feeCents = Math.round((subtotalCents * feeRatePercent) / 100);

  const lineItems = [...grouped.values()].map((item) => ({
    price_data: {
      currency: "usd",
      product_data: {
        name: item.name,
        description: "Shop 1104 — custom embroidery order.",
      },
      unit_amount: item.unit_amount,
    },
    quantity: item.quantity,
  }));

  if (taxCents > 0) {
    lineItems.push({
      price_data: {
        currency: "usd",
        product_data: { name: `Sales Tax (${taxRatePercent}%)` },
        unit_amount: taxCents,
      },
      quantity: 1,
    });
  }

  if (feeCents > 0) {
    lineItems.push({
      price_data: {
        currency: "usd",
        product_data: { name: `Card Processing Fee (${feeRatePercent}%)` },
        unit_amount: feeCents,
      },
      quantity: 1,
    });
  }

  if (order.shipping_cents > 0) {
    lineItems.push({
      price_data: {
        currency: "usd",
        product_data: { name: "Shipping" },
        unit_amount: order.shipping_cents,
      },
      quantity: 1,
    });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      client_reference_id: orderId,
      customer_email: order.customer_email,
      line_items: lineItems,
      success_url: `${siteUrl}/order-confirmation?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}${cancelPath}`,
      metadata: { orderId },
    });

    return { statusCode: 200, body: JSON.stringify({ url: session.url }) };
  } catch (err) {
    console.error("Stripe session creation error:", err);
    return { statusCode: 500, body: JSON.stringify({ error: "Could not start checkout." }) };
  }
};
