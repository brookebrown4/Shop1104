// netlify/functions/admin-requests.cjs
//
// Admin-only. Lists Custom Order requests and Contact messages for the
// admin "Requests" tab. Gated by x-admin-code header (same ADMIN_ACCESS_CODE
// as the rest of the admin panel). Read-only for now -- status changes can
// be added later if needed.

const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function isAuthorized(event) {
  const code = event.headers["x-admin-code"];
  return code && process.env.ADMIN_ACCESS_CODE && code === process.env.ADMIN_ACCESS_CODE;
}

exports.handler = async (event) => {
  if (!isAuthorized(event)) {
    return { statusCode: 401, body: JSON.stringify({ error: "Not authorized." }) };
  }
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const [{ data: customRequests, error: reqErr }, { data: contactMessages, error: msgErr }] = await Promise.all([
    supabase.from("custom_order_requests").select("*").order("created_at", { ascending: false }),
    supabase.from("contact_messages").select("*").order("created_at", { ascending: false }),
  ]);

  if (reqErr || msgErr) {
    console.error("Supabase error (admin-requests):", reqErr || msgErr);
    return { statusCode: 500, body: JSON.stringify({ error: "Could not load requests." }) };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      customRequests: (customRequests || []).map((r) => ({
        id: r.id,
        fullName: r.full_name,
        email: r.email,
        phone: r.phone,
        address: r.address,
        garmentType: r.garment_type,
        quantity: r.quantity,
        needBy: r.need_by || "—",
        hasDesign: r.has_design,
        createdAt: r.created_at,
      })),
      contactMessages: (contactMessages || []).map((m) => ({
        id: m.id,
        fullName: m.full_name,
        email: m.email,
        phone: m.phone,
        orderNumber: m.order_number || "—",
        message: m.message,
        createdAt: m.created_at,
      })),
    }),
  };
};
