import { useState } from "react";
import * as api from "../api";

export default function Checkout({ cart, fulfillment, setFulfillment, shippingSettings, portal }) {
  const { cart: items, subtotalCents } = cart;
  const [form, setForm] = useState({ name: "", email: "", phone: "", street: "", city: "", state: "", zip: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const shippingCents = (() => {
    if (fulfillment === "pickup" || items.length === 0) return 0;
    const freeThresholdCents = Math.round((shippingSettings.freeThreshold || 0) * 100);
    if (freeThresholdCents > 0 && subtotalCents >= freeThresholdCents) return 0;
    const count = items.reduce((n, i) => n + i.qty, 0);
    return Math.round((shippingSettings.base || 0) * 100) + Math.round((shippingSettings.perItem || 0) * 100) * count;
  })();
  const totalCents = subtotalCents + shippingCents;

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const placeOrder = async () => {
    setError("");
    if (!form.name || !form.email || !form.phone) {
      setError("Name, email, and phone are required.");
      return;
    }
    if (fulfillment === "ship" && (!form.street || !form.city || !form.state || !form.zip)) {
      setError("A complete shipping address is required.");
      return;
    }
    setSubmitting(true);
    try {
      const orderPayload = {
        name: form.name,
        email: form.email,
        phone: form.phone,
        portalCode: portal.loggedIn ? portal.code : undefined,
        fulfillment,
        address: fulfillment === "ship" ? { street: form.street, city: form.city, state: form.state, zip: form.zip } : undefined,
        items: items.map((i) => ({
          productId: i.productId,
          qty: i.qty,
          size: i.size || undefined,
          color: i.color || undefined,
          thread: i.thread || undefined,
          placement: i.placement || undefined,
          design: i.design || undefined,
          personalize: i.personalize || undefined,
          notes: i.notes || undefined,
          addons: i.addons && i.addons.length ? i.addons : undefined,
        })),
      };
      const { orderId } = await api.submitGeneralOrder(orderPayload);
      const { url } = await api.createCheckoutSession(orderId);
      window.location.href = url;
    } catch (e) {
      setError(e.message || "Something went wrong starting checkout.");
      setSubmitting(false);
    }
  };

  return (
    <section className="shop-section">
      <h1>Checkout</h1>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 30, alignItems: "start", marginTop: 20 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 30 }}>
          {error && <p style={{ color: "var(--color-accent-2-700)" }}>{error}</p>}

          <div>
            <h5>Fulfillment</h5>
            <div className="seg">
              <label className="seg-opt"><input type="radio" name="fulfill" checked={fulfillment === "ship"} onChange={() => setFulfillment("ship")} />Ship to address</label>
              <label className="seg-opt"><input type="radio" name="fulfill" checked={fulfillment === "pickup"} onChange={() => setFulfillment("pickup")} />Local pickup</label>
            </div>
          </div>

          <div>
            <h5>Contact</h5>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 15 }}>
              <div className="field"><label>Full name</label><input className="input" placeholder="Jordan Ramirez" value={form.name} onChange={set("name")} /></div>
              <div className="field"><label>Email</label><input className="input" placeholder="jordan@email.com" value={form.email} onChange={set("email")} /></div>
              <div className="field"><label>Phone</label><input className="input" placeholder="(555) 010-0199" value={form.phone} onChange={set("phone")} /></div>
            </div>
          </div>

          {fulfillment === "ship" ? (
            <div>
              <h5>Shipping address</h5>
              <div style={{ display: "grid", gap: 15 }}>
                <div className="field"><label>Street address</label><input className="input" placeholder="123 Main St" value={form.street} onChange={set("street")} /></div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 15 }}>
                  <div className="field"><label>City</label><input className="input" value={form.city} onChange={set("city")} /></div>
                  <div className="field"><label>State</label><input className="input" value={form.state} onChange={set("state")} /></div>
                  <div className="field"><label>ZIP</label><input className="input" value={form.zip} onChange={set("zip")} /></div>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-muted">Pick up at Shop 1104 — we'll text you when your order's ready.</p>
          )}

          <div>
            <h5>Payment</h5>
            <p className="text-muted">You'll enter your card details on Stripe's secure checkout page after clicking "Place order."</p>
          </div>
        </div>

        <div className="card elev-sm">
          <div className="card-title">Order summary</div>
          {items.map((i) => (
            <div key={i.cartId} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span>{i.name} ×{i.qty}</span><span>${((i.priceCents * i.qty) / 100).toFixed(2)}</span>
            </div>
          ))}
          <div className="hr" style={{ margin: "10px 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}><span>Subtotal</span><span>${(subtotalCents / 100).toFixed(2)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}><span>Shipping</span><span>${(shippingCents / 100).toFixed(2)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--font-heading)", fontSize: 17 }}><span>Total</span><span>${(totalCents / 100).toFixed(2)}</span></div>
          <button className="btn btn-primary btn-block" onClick={placeOrder} disabled={submitting || items.length === 0}>
            {submitting ? "Starting checkout…" : "Place order"}
          </button>
        </div>
      </div>
    </section>
  );
}
