// netlify/functions/get-order-confirmation.cjs
//
// Public, read-only. Powers the Order Confirmation page. Stripe redirects
// the browser here with ?session_id=... after checkout -- per the design
// handoff, we never trust that redirect alone, so this verifies the
// session server-side with Stripe before telling the frontend the order
// is paid, then returns a safe summary (no internal ids, no full address).
//
// GET ?session_id=cs_test_...

const Stripe = require("stripe");
const { createClient } = require("@supabase/supabase-js");

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const sessionId = event.queryStringParameters && event.queryStringParameters.session_id;
  if (!sessionId) {
    return { statusCode: 400, body: JSON.stringify({ error: "session_id is required." }) };
  }

  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch (err) {
    console.error("Stripe session retrieve error:", err);
    return { statusCode: 404, body: JSON.stringify({ error: "Checkout session not found." }) };
  }

  if (session.payment_status !== "paid") {
    return { statusCode: 200, body: JSON.stringify({ paid: false }) };
  }

  const orderId = session.client_reference_id || (session.metadata && session.metadata.orderId);
  if (!orderId) {
    return { statusCode: 200, body: JSON.stringify({ paid: true, orderNumber: sessionId.slice(-8).toUpperCase(), items: [] }) };
  }

  const { data: order, error } = await supabase
    .from("orders")
    .select("id, garments, amount_cents, shipping_cents")
    .eq("id", orderId)
    .maybeSingle();

  if (error || !order) {
    // Stripe confirmed payment even if we can't find the local row (e.g. the
    // webhook is still catching up) -- still tell the customer they're paid.
    return { statusCode: 200, body: JSON.stringify({ paid: true, orderNumber: sessionId.slice(-8).toUpperCase(), items: [] }) };
  }

  const items = (order.garments || []).map((g) => ({ name: g.product_name, qty: g.qty || 1 }));

  return {
    statusCode: 200,
    body: JSON.stringify({
      paid: true,
      orderNumber: order.id.slice(0, 8).toUpperCase(),
      items,
      totalCents: (order.amount_cents || 0) + (order.shipping_cents || 0),
    }),
  };
};
