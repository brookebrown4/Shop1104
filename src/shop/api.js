// Shop 1104 — general storefront API helpers. Talks to the Netlify
// functions using the same conventions as the rest of the app: no base
// URL (functions are same-origin at /.netlify/functions/*), JSON bodies,
// admin calls send the code in an x-admin-code header.

const FN = "/.netlify/functions";

async function req(path, options = {}) {
  const res = await fetch(`${FN}/${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    // some endpoints (405s etc.) may not return JSON
  }
  if (!res.ok) {
    throw new Error((data && data.error) || `Request failed (${res.status})`);
  }
  if (data === null) {
    // A 2xx with no parseable JSON body means this isn't actually the
    // function responding (e.g. a dev server's SPA fallback serving
    // index.html for an unknown path) -- treat it as a failure rather
    // than handing callers a null they don't expect.
    throw new Error("Unexpected response (not JSON).");
  }
  return data;
}

export function getProducts(portalCode) {
  const qs = portalCode ? `?portalCode=${encodeURIComponent(portalCode)}` : "";
  return req(`get-products${qs}`);
}

export function getProduct(id) {
  return req(`get-product?id=${encodeURIComponent(id)}`);
}

export function getSiteContent() {
  return req("get-site-content");
}

export function getPortal(code, password) {
  const qs = new URLSearchParams({ code, ...(password ? { password } : {}) });
  return req(`get-portal?${qs.toString()}`);
}

export function submitGeneralOrder(order) {
  return req("submit-general-order", { method: "POST", body: JSON.stringify(order) });
}

export function createCheckoutSession(orderId) {
  return req("create-checkout-session", { method: "POST", body: JSON.stringify({ orderId }) });
}

export function getOrderConfirmation(sessionId) {
  return req(`get-order-confirmation?session_id=${encodeURIComponent(sessionId)}`);
}

export function submitCustomOrder(fields) {
  return req("submit-custom-order", { method: "POST", body: JSON.stringify(fields) });
}

export function submitContact(fields) {
  return req("submit-contact", { method: "POST", body: JSON.stringify(fields) });
}

// ── admin ────────────────────────────────────────────────────────────────

function adminHeaders(adminCode) {
  return { "x-admin-code": adminCode };
}

export function adminListProducts(adminCode, store) {
  return req(`admin-products?store=${encodeURIComponent(store ?? "")}`, { headers: adminHeaders(adminCode) });
}

export function adminSaveProduct(adminCode, body) {
  return req("admin-products", { method: "POST", headers: adminHeaders(adminCode), body: JSON.stringify(body) });
}

export function adminSiteContent(adminCode, body) {
  return req("admin-site-content", { method: "POST", headers: adminHeaders(adminCode), body: JSON.stringify(body) });
}

export function adminListPortals(adminCode) {
  return req("admin-portals", { headers: adminHeaders(adminCode) });
}

export function adminPortals(adminCode, body) {
  return req("admin-portals", { method: "POST", headers: adminHeaders(adminCode), body: JSON.stringify(body) });
}

export function adminListRequests(adminCode) {
  return req("admin-requests", { headers: adminHeaders(adminCode) });
}

export function adminListOrders(adminCode) {
  return req("admin-orders", { headers: adminHeaders(adminCode) });
}

export function adminOrders(adminCode, body) {
  return req("admin-orders", { method: "POST", headers: adminHeaders(adminCode), body: JSON.stringify(body) });
}
