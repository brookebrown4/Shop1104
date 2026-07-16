// netlify/functions/stripe-webhook.js
//
// Listens for Stripe's "checkout.session.completed" event and marks the
// matching Supabase order as paid. Register this function's URL as a
// webhook endpoint in your Stripe Dashboard:
//   https://yoursite.netlify.app/.netlify/functions/stripe-webhook
//
// IMPORTANT: this function needs the RAW request body to verify Stripe's
// signature, so it must NOT be parsed as JSON by Netlify first. Netlify
// Functions pass the raw body through event.body as long as you don't add
// a body-parsing plugin — the default setup works fine.

const Stripe = require("stripe");
const { createClient } = require("@supabase/supabase-js");

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

exports.handler = async (event) => {
  const signature = event.headers["stripe-signature"];
  let stripeEvent;

  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  if (stripeEvent.type === "checkout.session.completed") {
    const session = stripeEvent.data.object;
    const orderId = session.client_reference_id;

    if (orderId) {
      const { error } = await supabase
        .from("orders")
        .update({
          status: "paid",
          stripe_session_id: session.id,
          stripe_payment_intent: session.payment_intent,
        })
        .eq("id", orderId);

      if (error) {
        console.error("Supabase update error:", error);
        // Return 500 so Stripe retries the webhook automatically.
        return { statusCode: 500, body: "Could not update order." };
      }
    }
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
