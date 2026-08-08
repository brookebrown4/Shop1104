// netlify/functions/submit-custom-order.cjs
//
// Public. Saves a Custom Order request (Custom Order page) to Supabase for
// admin follow-up. No pricing or payment here -- Shop 1104 reaches out with
// a quote afterward.

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

  const { fullName, email, phone, address, garmentType, quantity, needBy, hasDesign, attachmentUrls } = body || {};
  if (!fullName || !email || !phone || !address || !garmentType || !quantity) {
    return { statusCode: 400, body: JSON.stringify({ error: "Missing required fields." }) };
  }

  const { error } = await supabase.from("custom_order_requests").insert({
    full_name: fullName,
    email,
    phone,
    address,
    garment_type: garmentType,
    quantity: Math.max(1, parseInt(quantity, 10) || 1),
    need_by: needBy || null,
    has_design: typeof hasDesign === "boolean" ? hasDesign : null,
    attachment_urls: Array.isArray(attachmentUrls) ? attachmentUrls : [],
  });

  if (error) {
    console.error("Supabase insert error (custom_order_requests):", error);
    return { statusCode: 500, body: JSON.stringify({ error: "Could not submit request." }) };
  }

  return { statusCode: 200, body: JSON.stringify({ ok: true }) };
};
