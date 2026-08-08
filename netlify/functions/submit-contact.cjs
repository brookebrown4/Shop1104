// netlify/functions/submit-contact.cjs
//
// Public. Saves a Contact page message to Supabase for admin follow-up.

const { createClient } = require("@supabase/supabase-js");
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

  const { fullName, email, phone, orderNumber, message } = body || {};
  if (!fullName || !email || !phone || !message) {
    return { statusCode: 400, body: JSON.stringify({ error: "Missing required fields." }) };
  }

  const { error } = await supabase.from("contact_messages").insert({
    full_name: fullName,
    email,
    phone,
    order_number: orderNumber || null,
    message,
  });

  if (error) {
    console.error("Supabase insert error (contact_messages):", error);
    return { statusCode: 500, body: JSON.stringify({ error: "Could not send message." }) };
  }

  return { statusCode: 200, body: JSON.stringify({ ok: true }) };
};
