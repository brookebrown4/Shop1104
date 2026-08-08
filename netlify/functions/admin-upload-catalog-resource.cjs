// netlify/functions/admin-upload-catalog-resource.cjs
//
// Admin-only. Uploads a catalog reference PDF to real Supabase Storage
// (bucket "catalog-resources", see sql/2026-08-08_catalog_storage_bucket.sql)
// and records its public URL in site_content under key "catalogResources".
// Replaces the earlier approach of embedding the file as a base64 data:
// URL, which browsers handle unreliably for in-page preview.
//
// POST { key: "threadColors" | "fontOptions" | "monogramStyles" | "designs",
//        fileName, fileBase64 }

const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const VALID_KEYS = new Set(["threadColors", "fontOptions", "monogramStyles", "designs"]);
const BUCKET = "catalog-resources";

function isAuthorized(event) {
  const code = event.headers["x-admin-code"];
  return code && process.env.ADMIN_ACCESS_CODE && code === process.env.ADMIN_ACCESS_CODE;
}

exports.handler = async (event) => {
  if (!isAuthorized(event)) {
    return { statusCode: 401, body: JSON.stringify({ error: "Not authorized." }) };
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

  const { key, fileName, fileBase64 } = body || {};
  if (!VALID_KEYS.has(key) || !fileName || !fileBase64) {
    return { statusCode: 400, body: JSON.stringify({ error: "key, fileName, and fileBase64 are required." }) };
  }

  const commaIdx = fileBase64.indexOf(",");
  const base64Data = commaIdx >= 0 ? fileBase64.slice(commaIdx + 1) : fileBase64;
  let buffer;
  try {
    buffer = Buffer.from(base64Data, "base64");
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Could not decode file data." }) };
  }
  if (buffer.length > 10 * 1024 * 1024) {
    return { statusCode: 400, body: JSON.stringify({ error: "File is too large (10MB max)." }) };
  }

  const path = `${key}/${Date.now()}-${fileName.replace(/[^a-zA-Z0-9_.-]/g, "_")}`;

  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: "application/pdf", upsert: false });
  if (uploadErr) {
    console.error("Supabase storage upload error:", uploadErr);
    return { statusCode: 500, body: JSON.stringify({ error: "Could not upload file." }) };
  }

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);

  const { data: existingRow } = await supabase.from("site_content").select("value").eq("key", "catalogResources").maybeSingle();
  const nextValue = { ...(existingRow && existingRow.value), [key]: { url: pub.publicUrl, fileName } };

  const { error: saveErr } = await supabase
    .from("site_content")
    .upsert({ key: "catalogResources", value: nextValue, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (saveErr) {
    console.error("Supabase site_content upsert error:", saveErr);
    return { statusCode: 500, body: JSON.stringify({ error: "File uploaded but could not save the link." }) };
  }

  return { statusCode: 200, body: JSON.stringify({ url: pub.publicUrl, fileName }) };
};
