import React, { useState, useEffect } from "react";
import { Scissors, Mail, Phone, User, MapPin, Plus, Minus, Shirt, Truck, Store } from "lucide-react";

/**
 * Shop 1104 — Pre-Order Intake Form
 *
 * Drop this into your React site (e.g. src/components/PreorderIntakeForm.jsx).
 * It's fully self-contained — no external CSS needed beyond Tailwind's core
 * utilities, which your site already has set up.
 *
 * HOW PRICING WORKS:
 * On load, this form calls /.netlify/functions/get-active-sale, which returns
 * whichever sale you've marked active in the admin panel (see
 * SalesAdminPanel.jsx) along with its priced items. Customers pick from
 * those items — there's nothing about garments, logos, or prices hardcoded
 * here. When you're ready to run a different sale with different items,
 * just create it and activate it in the admin panel; this form updates
 * automatically.
 *
 * ORDER + PAYMENT FLOW:
 *   1. POSTs the order to /.netlify/functions/submit-order, which re-prices
 *      it server-side (never trusts the browser) and saves it to Supabase
 *      as "pending", returning an orderId.
 *   2. POSTs { orderId } to /.netlify/functions/create-checkout-session,
 *      which builds a Stripe Checkout Session from the saved order and
 *      returns a checkout URL.
 *   3. Redirects the customer to that URL to pay.
 * Stripe then redirects back to your success page, and a webhook
 * (/.netlify/functions/stripe-webhook) marks the order "paid" in Supabase.
 * See SETUP-INSTRUCTIONS.md for full setup steps.
 */

const COLORS = {
  canvas: "#EFEAE0",
  card: "#F8F5ED",
  ink: "#1D2B3A",
  inkSoft: "#4A5A6A",
  line: "#D9D2C0",
  rust: "#A64B2A",
  rustDark: "#8A3D22",
  gold: "#B8902E",
};

const SIZE_OPTIONS = [
  "Youth S",
  "Youth M",
  "Youth L",
  "Adult S",
  "Adult M",
  "Adult L",
  "Adult XL",
  "Adult 2XL",
  "Adult 3XL",
  "Adult 4XL",
];

const emptyGarment = () => ({ productId: "", color: "", size: "" });

const emptyForm = {
  name: "",
  email: "",
  phone: "",
  garments: [emptyGarment()],
  fulfillment: "ship",
  address: { line1: "", line2: "", city: "", state: "", zip: "" },
};

export default function PreorderIntakeForm() {
  const [loadingSale, setLoadingSale] = useState(true);
  const [sale, setSale] = useState(null);
  const [products, setProducts] = useState([]);
  const [loadError, setLoadError] = useState("");

  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/.netlify/functions/get-active-sale")
      .then((res) => {
        if (!res.ok) throw new Error("Could not load current sale.");
        return res.json();
      })
      .then(({ sale, products }) => {
        if (cancelled) return;
        setSale(sale);
        setProducts(products || []);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(err.message || "Could not load current sale.");
      })
      .finally(() => {
        if (!cancelled) setLoadingSale(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const productById = (id) => products.find((p) => p.id === id);

  const updateField = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const updateAddress = (field, value) =>
    setForm((f) => ({ ...f, address: { ...f.address, [field]: value } }));

  const updateGarment = (index, field, value) =>
    setForm((f) => {
      const garments = [...f.garments];
      garments[index] = { ...garments[index], [field]: value };
      return { ...f, garments };
    });

  const addGarment = () => setForm((f) => ({ ...f, garments: [...f.garments, emptyGarment()] }));

  const removeGarment = (index) =>
    setForm((f) => ({
      ...f,
      garments: f.garments.length > 1 ? f.garments.filter((_, i) => i !== index) : f.garments,
    }));

  const totalCents = form.garments.reduce((sum, g) => {
    const product = productById(g.productId);
    return sum + (product ? product.price_cents : 0);
  }, 0);

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = "Name is required.";
    if (!form.email.trim()) errs.email = "Email is required.";
    else if (!/^\S+@\S+\.\S+$/.test(form.email)) errs.email = "Enter a valid email.";
    if (!form.phone.trim()) errs.phone = "Phone number is required.";

    form.garments.forEach((g, i) => {
      if (!g.productId) errs[`garment-${i}-productId`] = "Choose an item.";
      if (!g.color.trim()) errs[`garment-${i}-color`] = "Color is required.";
      if (!g.size) errs[`garment-${i}-size`] = "Pick a size.";
    });

    if (form.fulfillment === "ship") {
      if (!form.address.line1.trim()) errs.line1 = "Address is required.";
      if (!form.address.city.trim()) errs.city = "City is required.";
      if (!form.address.state.trim()) errs.state = "State is required.";
      if (!form.address.zip.trim()) errs.zip = "ZIP is required.";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!sale) return;
    if (!validate()) return;

    setSubmitError("");
    setSubmitting(true);

    const payload = {
      name: form.name,
      email: form.email,
      phone: form.phone,
      saleId: sale.id,
      garments: form.garments.map((g) => ({
        productId: g.productId,
        color: g.color,
        size: g.size,
      })),
      fulfillment: form.fulfillment,
      address: form.address,
    };

    try {
      // 1. Save the order to Supabase as "pending" (server re-prices it)
      const orderRes = await fetch("/.netlify/functions/submit-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!orderRes.ok) {
        const err = await orderRes.json().catch(() => ({}));
        throw new Error(err.error || "Could not save your order. Please try again.");
      }
      const { orderId } = await orderRes.json();

      // 2. Create a Stripe Checkout session for the saved order
      const sessionRes = await fetch("/.netlify/functions/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      if (!sessionRes.ok) {
        const err = await sessionRes.json().catch(() => ({}));
        throw new Error(err.error || "Could not start checkout. Please try again.");
      }
      const { url } = await sessionRes.json();

      // 3. Send the customer to Stripe to pay
      window.location.href = url;
    } catch (err) {
      setSubmitError(err.message || "Something went wrong. Please try again.");
      setSubmitting(false);
    }
  };

  const fieldStyle = {
    border: `1px solid ${COLORS.line}`,
    backgroundColor: "#FFFFFF",
    color: COLORS.ink,
  };

  const errorText = (key) =>
    errors[key] ? (
      <p className="text-xs mt-1" style={{ color: COLORS.rustDark }}>
        {errors[key]}
      </p>
    ) : null;

  const fontImport = (
    <style>{`@import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@500;600&family=Work+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@500&display=swap');`}</style>
  );

  // Loading state
  if (loadingSale) {
    return (
      <div
        className="min-h-screen w-full flex items-center justify-center p-6"
        style={{ backgroundColor: COLORS.canvas, fontFamily: "'Work Sans', sans-serif" }}
      >
        {fontImport}
        <p className="text-sm" style={{ color: COLORS.inkSoft }}>
          Loading current pre-order…
        </p>
      </div>
    );
  }

  // No active sale (or failed to load one)
  if (loadError || !sale) {
    return (
      <div
        className="min-h-screen w-full flex items-center justify-center p-6"
        style={{ backgroundColor: COLORS.canvas, fontFamily: "'Work Sans', sans-serif" }}
      >
        {fontImport}
        <div
          className="max-w-md w-full rounded-lg p-8 text-center"
          style={{ backgroundColor: COLORS.card, border: `1px solid ${COLORS.line}` }}
        >
          <h1
            className="text-2xl mb-2"
            style={{ fontFamily: "'Fraunces', serif", color: COLORS.ink, fontWeight: 600 }}
          >
            No pre-order running right now
          </h1>
          <p className="text-sm" style={{ color: COLORS.inkSoft }}>
            {loadError || "Check back soon, or follow Shop 1104 for updates on the next sale."}
          </p>
        </div>
      </div>
    );
  }

  // Active sale, but no products configured yet
  if (products.length === 0) {
    return (
      <div
        className="min-h-screen w-full flex items-center justify-center p-6"
        style={{ backgroundColor: COLORS.canvas, fontFamily: "'Work Sans', sans-serif" }}
      >
        {fontImport}
        <div
          className="max-w-md w-full rounded-lg p-8 text-center"
          style={{ backgroundColor: COLORS.card, border: `1px solid ${COLORS.line}` }}
        >
          <h1
            className="text-2xl mb-2"
            style={{ fontFamily: "'Fraunces', serif", color: COLORS.ink, fontWeight: 600 }}
          >
            {sale.name}
          </h1>
          <p className="text-sm" style={{ color: COLORS.inkSoft }}>
            This sale is active but doesn't have any items set up yet — add some in the admin panel.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen w-full flex justify-center p-6"
      style={{ backgroundColor: COLORS.canvas, fontFamily: "'Work Sans', sans-serif" }}
    >
      {fontImport}
      <form onSubmit={handleSubmit} className="max-w-xl w-full py-4">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <Scissors size={14} color={COLORS.gold} />
            <span
              className="text-xs tracking-widest uppercase"
              style={{ fontFamily: "'IBM Plex Mono', monospace", color: COLORS.gold, letterSpacing: "0.15em" }}
            >
              Shop 1104 · Indianola, Iowa
            </span>
          </div>
          <h1
            className="text-3xl mb-2"
            style={{ fontFamily: "'Fraunces', serif", color: COLORS.ink, fontWeight: 600 }}
          >
            {sale.name}
          </h1>
          <div style={{ borderBottom: `2px dashed ${COLORS.line}`, width: "64px", marginBottom: "12px" }} />
          <p className="text-sm mb-3" style={{ color: COLORS.inkSoft }}>
            Tell us who it's for, which item, and how many — we'll take it from there.
          </p>
          <p
            className="text-xs rounded-md px-3 py-2 inline-block"
            style={{ backgroundColor: COLORS.card, border: `1px solid ${COLORS.line}`, color: COLORS.inkSoft }}
          >
            Note: applicable sales tax and shipping costs are the customer's responsibility and are
            not included in the item price.
          </p>
        </div>

        {/* Contact info */}
        <section
          className="rounded-lg p-6 mb-6"
          style={{ backgroundColor: COLORS.card, border: `1px solid ${COLORS.line}` }}
        >
          <h2 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: COLORS.ink }}>
            <User size={15} /> Contact Info
          </h2>
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="text-xs mb-1 block" style={{ color: COLORS.inkSoft }}>
                Full name
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
                className="w-full rounded-md px-3 py-2 text-sm outline-none"
                style={fieldStyle}
                placeholder="Jane Doe"
              />
              {errorText("name")}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs mb-1 flex items-center gap-1" style={{ color: COLORS.inkSoft }}>
                  <Mail size={12} /> Email
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => updateField("email", e.target.value)}
                  className="w-full rounded-md px-3 py-2 text-sm outline-none"
                  style={fieldStyle}
                  placeholder="jane@email.com"
                />
                {errorText("email")}
              </div>
              <div>
                <label className="text-xs mb-1 flex items-center gap-1" style={{ color: COLORS.inkSoft }}>
                  <Phone size={12} /> Phone
                </label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => updateField("phone", e.target.value)}
                  className="w-full rounded-md px-3 py-2 text-sm outline-none"
                  style={fieldStyle}
                  placeholder="(515) 555-0110"
                />
                {errorText("phone")}
              </div>
            </div>
          </div>
        </section>

        {/* Garments */}
        <section className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: COLORS.ink }}>
              <Shirt size={15} /> Garments ({form.garments.length})
            </h2>
            <button
              type="button"
              onClick={addGarment}
              className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md"
              style={{ border: `1px solid ${COLORS.line}`, color: COLORS.ink, backgroundColor: COLORS.card }}
            >
              <Plus size={13} /> Add garment
            </button>
          </div>

          <div className="flex flex-col gap-4">
            {form.garments.map((g, i) => (
              <div
                key={i}
                className="rounded-lg p-5 relative"
                style={{ backgroundColor: COLORS.card, border: `1px dashed ${COLORS.line}` }}
              >
                <div className="flex items-center justify-between mb-3">
                  <span
                    className="text-xs"
                    style={{ fontFamily: "'IBM Plex Mono', monospace", color: COLORS.gold }}
                  >
                    Garment No. {String(i + 1).padStart(2, "0")}
                  </span>
                  {form.garments.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeGarment(i)}
                      className="flex items-center gap-1 text-xs"
                      style={{ color: COLORS.rustDark }}
                    >
                      <Minus size={12} /> Remove
                    </button>
                  )}
                </div>

                <div className="mb-3">
                  <label className="text-xs mb-1 block" style={{ color: COLORS.inkSoft }}>
                    Item
                  </label>
                  <select
                    value={g.productId}
                    onChange={(e) => updateGarment(i, "productId", e.target.value)}
                    className="w-full rounded-md px-3 py-2 text-sm outline-none"
                    style={fieldStyle}
                  >
                    <option value="">Choose item…</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} — ${(p.price_cents / 100).toFixed(2)}
                      </option>
                    ))}
                  </select>
                  {errorText(`garment-${i}-productId`)}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: COLORS.inkSoft }}>
                      Color
                    </label>
                    <input
                      type="text"
                      value={g.color}
                      onChange={(e) => updateGarment(i, "color", e.target.value)}
                      className="w-full rounded-md px-3 py-2 text-sm outline-none"
                      style={fieldStyle}
                      placeholder="e.g. Heather Gray"
                    />
                    {errorText(`garment-${i}-color`)}
                  </div>
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: COLORS.inkSoft }}>
                      Size
                    </label>
                    <select
                      value={g.size}
                      onChange={(e) => updateGarment(i, "size", e.target.value)}
                      className="w-full rounded-md px-3 py-2 text-sm outline-none"
                      style={fieldStyle}
                    >
                      <option value="">Choose size…</option>
                      {SIZE_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                    {errorText(`garment-${i}-size`)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Fulfillment */}
        <section
          className="rounded-lg p-6 mb-6"
          style={{ backgroundColor: COLORS.card, border: `1px solid ${COLORS.line}` }}
        >
          <h2 className="text-sm font-semibold mb-4" style={{ color: COLORS.ink }}>
            Fulfillment
          </h2>
          <div className="grid grid-cols-2 gap-3 mb-2">
            <button
              type="button"
              onClick={() => updateField("fulfillment", "ship")}
              className="flex items-center justify-center gap-2 rounded-md py-2.5 text-sm"
              style={{
                border: `1px solid ${form.fulfillment === "ship" ? COLORS.ink : COLORS.line}`,
                backgroundColor: form.fulfillment === "ship" ? COLORS.ink : "#FFFFFF",
                color: form.fulfillment === "ship" ? "#FFFFFF" : COLORS.ink,
              }}
            >
              <Truck size={15} /> Ship it to me
            </button>
            <button
              type="button"
              onClick={() => updateField("fulfillment", "pickup")}
              className="flex items-center justify-center gap-2 rounded-md py-2.5 text-sm"
              style={{
                border: `1px solid ${form.fulfillment === "pickup" ? COLORS.ink : COLORS.line}`,
                backgroundColor: form.fulfillment === "pickup" ? COLORS.ink : "#FFFFFF",
                color: form.fulfillment === "pickup" ? "#FFFFFF" : COLORS.ink,
              }}
            >
              <Store size={15} /> Local pickup
            </button>
          </div>

          {form.fulfillment === "ship" && (
            <div className="mt-4 grid grid-cols-1 gap-3">
              <div>
                <label className="text-xs mb-1 flex items-center gap-1" style={{ color: COLORS.inkSoft }}>
                  <MapPin size={12} /> Address line 1
                </label>
                <input
                  type="text"
                  value={form.address.line1}
                  onChange={(e) => updateAddress("line1", e.target.value)}
                  className="w-full rounded-md px-3 py-2 text-sm outline-none"
                  style={fieldStyle}
                />
                {errorText("line1")}
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: COLORS.inkSoft }}>
                  Address line 2 (optional)
                </label>
                <input
                  type="text"
                  value={form.address.line2}
                  onChange={(e) => updateAddress("line2", e.target.value)}
                  className="w-full rounded-md px-3 py-2 text-sm outline-none"
                  style={fieldStyle}
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs mb-1 block" style={{ color: COLORS.inkSoft }}>
                    City
                  </label>
                  <input
                    type="text"
                    value={form.address.city}
                    onChange={(e) => updateAddress("city", e.target.value)}
                    className="w-full rounded-md px-3 py-2 text-sm outline-none"
                    style={fieldStyle}
                  />
                  {errorText("city")}
                </div>
                <div>
                  <label className="text-xs mb-1 block" style={{ color: COLORS.inkSoft }}>
                    State
                  </label>
                  <input
                    type="text"
                    value={form.address.state}
                    onChange={(e) => updateAddress("state", e.target.value)}
                    className="w-full rounded-md px-3 py-2 text-sm outline-none"
                    style={fieldStyle}
                  />
                  {errorText("state")}
                </div>
                <div>
                  <label className="text-xs mb-1 block" style={{ color: COLORS.inkSoft }}>
                    ZIP
                  </label>
                  <input
                    type="text"
                    value={form.address.zip}
                    onChange={(e) => updateAddress("zip", e.target.value)}
                    className="w-full rounded-md px-3 py-2 text-sm outline-none"
                    style={fieldStyle}
                  />
                  {errorText("zip")}
                </div>
              </div>
            </div>
          )}
          {form.fulfillment === "pickup" && (
            <p className="text-xs mt-3" style={{ color: COLORS.inkSoft }}>
              Pickup available at Shop 1104, Indianola, IA — we'll text you when it's ready.
            </p>
          )}
        </section>

        <p className="text-xs mb-3 text-center" style={{ color: COLORS.inkSoft }}>
          Total due today: {"$" + (totalCents / 100).toFixed(2)} for {form.garments.length} garment
          {form.garments.length > 1 ? "s" : ""} · tax and shipping billed separately
        </p>

        {submitError && (
          <p
            className="text-xs mb-3 text-center rounded-md py-2"
            style={{ backgroundColor: COLORS.card, border: `1px solid ${COLORS.line}`, color: COLORS.rustDark }}
          >
            {submitError}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3 rounded-md text-sm font-semibold transition-colors"
          style={{
            backgroundColor: COLORS.rust,
            color: "#FFFFFF",
            opacity: submitting ? 0.7 : 1,
            cursor: submitting ? "not-allowed" : "pointer",
          }}
        >
          {submitting ? "Redirecting to payment…" : "Continue to Payment"}
        </button>
      </form>
    </div>
  );
}
