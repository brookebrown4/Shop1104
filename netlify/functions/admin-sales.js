// netlify/functions/admin-sales.js
//
// Admin-only. Manages "sales" (pre-order events). Gated by an admin code
// sent in the x-admin-code header, checked against ADMIN_ACCESS_CODE.
//
// GET                          -> list all sales, newest first
// POST { action: "create", name }
// POST { action: "activate", saleId }   -> deactivates all others first
// POST { action: "rename", saleId, name }
// POST { action: "delete", saleId }     -> also deletes its products (cascade)

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

  if (event.httpMethod === "GET") {
    const { data, error } = await supabase
      .from("sales")
      .select("id, name, is_active, created_at, products(count)")
      .order("created_at", { ascending: false });

    if (error) return { statusCode: 500, body: JSON.stringify({ error: "Could not load sales." }) };
    return { statusCode: 200, body: JSON.stringify({ sales: data }) };
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

  if (action === "create") {
    if (!body.name || !body.name.trim()) {
      return { statusCode: 400, body: JSON.stringify({ error: "Sale name is required." }) };
    }
    const { data, error } = await supabase
      .from("sales")
      .insert({ name: body.name.trim(), is_active: false })
      .select()
      .single();
    if (error) return { statusCode: 500, body: JSON.stringify({ error: "Could not create sale." }) };
    return { statusCode: 200, body: JSON.stringify({ sale: data }) };
  }

  if (action === "activate") {
    if (!body.saleId) return { statusCode: 400, body: JSON.stringify({ error: "saleId is required." }) };
    // Deactivate everything, then activate the chosen one.
    const { error: deactivateErr } = await supabase.from("sales").update({ is_active: false }).eq("is_active", true);
    if (deactivateErr) return { statusCode: 500, body: JSON.stringify({ error: "Could not deactivate current sale." }) };

    const { data, error } = await supabase
      .from("sales")
      .update({ is_active: true })
      .eq("id", body.saleId)
      .select()
      .single();
    if (error) return { statusCode: 500, body: JSON.stringify({ error: "Could not activate sale." }) };
    return { statusCode: 200, body: JSON.stringify({ sale: data }) };
  }

  if (action === "rename") {
    if (!body.saleId || !body.name || !body.name.trim()) {
      return { statusCode: 400, body: JSON.stringify({ error: "saleId and name are required." }) };
    }
    const { data, error } = await supabase
      .from("sales")
      .update({ name: body.name.trim() })
      .eq("id", body.saleId)
      .select()
      .single();
    if (error) return { statusCode: 500, body: JSON.stringify({ error: "Could not rename sale." }) };
    return { statusCode: 200, body: JSON.stringify({ sale: data }) };
  }

  if (action === "delete") {
    if (!body.saleId) return { statusCode: 400, body: JSON.stringify({ error: "saleId is required." }) };
    const { error } = await supabase.from("sales").delete().eq("id", body.saleId);
    if (error) return { statusCode: 500, body: JSON.stringify({ error: "Could not delete sale." }) };
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  }

  return { statusCode: 400, body: JSON.stringify({ error: "Unknown action." }) };
};
