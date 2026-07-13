import { useState, useEffect } from "react";

/**
 * Shop 1104 — Pre-Order Intake Form
 *
 * Restyled to match the rest of the site (same CSS variables and classes
 * from App.jsx's buildCSS — --green, --ink, --card-bg, --border, .btn-primary,
 * .form-group, etc.) instead of Tailwind, which isn't installed in this
 * project. Rendered as a normal page inside App.jsx's <div className="page">,
 * so it inherits the site's global styles automatically.
 */

const SIZE_OPTIONS = [
  "Youth S","Youth M","Youth L",
  "Adult S","Adult M","Adult L","Adult XL","Adult 2XL","Adult 3XL","Adult 4XL",
];

const emptyGarment = () => ({ productId: "", color: "", size: "" });
const emptyForm = {
  name: "", email: "", phone: "",
  garments: [emptyGarment()],
  fulfillment: "ship",
  address: { line1: "", line2: "", city: "", state: "", zip: "" },
};

export default function PreorderIntakeForm() {
  const [loadingSale, setLoadingSale] = useState(true);
  const [sale, setSale] = useState(null);
  const [products, setProducts] = useState([]);
  const [loadError, setLoadError] = useState("");
  const [taxRatePercent, setTaxRatePercent] = useState(0);
  const [feeRatePercent, setFeeRatePercent] = useState(0);
  const [collectPaymentNow, setCollectPaymentNow] = useState(true);
  const [orderSubmitted, setOrderSubmitted] = useState(false);

  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/.netlify/functions/get-active-sale")
      .then((res) => { if (!res.ok) throw new Error("Could not load current sale."); return res.json(); })
      .then(({ sale, products, taxRatePercent, feeRatePercent, collectPaymentNow }) => {
        if (cancelled) return;
        setSale(sale); setProducts(products || []);
        setTaxRatePercent(taxRatePercent || 0);
        setFeeRatePercent(feeRatePercent || 0);
        setCollectPaymentNow(collectPaymentNow !== false);
      })
      .catch((err) => { if (cancelled) return; setLoadError(err.message || "Could not load current sale."); })
      .finally(() => { if (!cancelled) setLoadingSale(false); });
    return () => { cancelled = true; };
  }, []);

  const productById = (id) => products.find((p) => p.id === id);
  const updateField = (field, value) => setForm((f) => ({ ...f, [field]: value }));
  const updateAddress = (field, value) => setForm((f) => ({ ...f, address: { ...f.address, [field]: value } }));
  const updateGarment = (index, field, value) =>
    setForm((f) => { const garments = [...f.garments]; garments[index] = { ...garments[index], [field]: value }; return { ...f, garments }; });
  const addGarment = () => setForm((f) => ({ ...f, garments: [...f.garments, emptyGarment()] }));
  const removeGarment = (index) =>
    setForm((f) => ({ ...f, garments: f.garments.length > 1 ? f.garments.filter((_, i) => i !== index) : f.garments }));

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
    setSubmitError(""); setSubmitting(true);
    const payload = {
      name: form.name, email: form.email, phone: form.phone, saleId: sale.id,
      garments: form.garments.map((g) => ({ productId: g.productId, color: g.color, size: g.size })),
      fulfillment: form.fulfillment, address: form.address,
    };
    try {
      const orderRes = await fetch("/.netlify/functions/submit-order", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      if (!orderRes.ok) { const err = await orderRes.json().catch(() => ({})); throw new Error(err.error || "Could not save your order. Please try again."); }
      const { orderId } = await orderRes.json();

      if (!collectPaymentNow) {
        // Short-term mode: just take the order, no Stripe checkout.
        // You'll follow up and invoice each customer directly.
        setOrderSubmitted(true);
        setSubmitting(false);
        return;
      }

      const sessionRes = await fetch("/.netlify/functions/create-checkout-session", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId }),
      });
      if (!sessionRes.ok) { const err = await sessionRes.json().catch(() => ({})); throw new Error(err.error || "Could not start checkout. Please try again."); }
      const { url } = await sessionRes.json();
      window.location.href = url;
    } catch (err) {
      setSubmitError(err.message || "Something went wrong. Please try again.");
      setSubmitting(false);
    }
  };

  const errorText = (key) => errors[key] ? (
    <p style={{ fontSize: ".72rem", color: "#c0392b", marginTop: ".3rem" }}>{errors[key]}</p>
  ) : null;

  if (orderSubmitted) {
    return (
      <div className="section">
        <p className="section-label">Pre-Order</p>
        <h2 className="section-title" style={{ marginBottom: "1rem" }}>Order received!</h2>
        <p className="section-body">
          Thanks — your pre-order for {sale.name} has been received. Shop 1104 will follow up
          directly with a bill for your order; no payment is needed here right now.
        </p>
      </div>
    );
  }

  if (loadingSale) {
    return <div className="section"><p className="section-body">Loading current pre-order…</p></div>;
  }

  if (loadError || !sale) {
    return (
      <div className="section">
        <p className="section-label">Pre-Order</p>
        <h2 className="section-title" style={{ marginBottom: "1rem" }}>No pre-order running right now</h2>
        <p className="section-body">{loadError || "Check back soon, or follow Shop 1104 for updates on the next sale."}</p>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="section">
        <p className="section-label">Pre-Order</p>
        <h2 className="section-title" style={{ marginBottom: "1rem" }}>{sale.name}</h2>
        <p className="section-body">This sale is active but doesn't have any items set up yet.</p>
      </div>
    );
  }

  return (
    <div className="section">
      <p className="section-label">Pre-Order</p>
      <h2 className="section-title" style={{ marginBottom: ".5rem" }}>{sale.name}</h2>
      <p className="section-body" style={{ marginBottom: "1rem" }}>
        Tell us who it's for, which item, and how many — we'll take it from there.
      </p>
      <p style={{ fontSize: ".8rem", color: "var(--ink-muted)", background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 10, padding: ".6rem 1rem", display: "inline-block", marginBottom: "2rem" }}>
        Note: {collectPaymentNow
          ? "applicable sales tax and a card processing fee are added at checkout. Shipping costs (if applicable) are billed separately."
          : "Shop 1104 will follow up directly with a bill for your order, including any tax and shipping costs."}
      </p>

      <form onSubmit={handleSubmit} style={{ maxWidth: 640 }}>
        {/* Contact info */}
        <div className="aform">
          <h3>Contact Info</h3>
          <div className="form-group"><label>Full name</label>
            <input type="text" value={form.name} onChange={(e) => updateField("name", e.target.value)} placeholder="Jane Doe" />
            {errorText("name")}
          </div>
          <div className="form-row" style={{ marginTop: "1rem" }}>
            <div className="form-group"><label>Email</label>
              <input type="email" value={form.email} onChange={(e) => updateField("email", e.target.value)} placeholder="jane@email.com" />
              {errorText("email")}
            </div>
            <div className="form-group"><label>Phone</label>
              <input type="tel" value={form.phone} onChange={(e) => updateField("phone", e.target.value)} placeholder="(515) 555-0110" />
              {errorText("phone")}
            </div>
          </div>
        </div>

        {/* Garments */}
        <div style={{ marginBottom: "1.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
            <h3 style={{ fontFamily: "'DM Serif Display',serif", fontSize: "1.1rem", color: "var(--ink)" }}>Garments ({form.garments.length})</h3>
            <button type="button" className="btn-sm-green" onClick={addGarment}>+ Add garment</button>
          </div>

          {form.garments.map((g, i) => (
            <div key={i} className="acard" style={{ border: "1.5px dashed var(--border)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: ".75rem" }}>
                <span style={{ fontSize: ".72rem", letterSpacing: ".1em", textTransform: "uppercase", color: "var(--green)", fontWeight: 600 }}>
                  Garment No. {String(i + 1).padStart(2, "0")}
                </span>
                {form.garments.length > 1 && (
                  <button type="button" className="btn-sm-danger" onClick={() => removeGarment(i)}>Remove</button>
                )}
              </div>

              <div className="form-group" style={{ marginBottom: ".75rem" }}>
                <label>Item</label>
                <select value={g.productId} onChange={(e) => { updateGarment(i, "productId", e.target.value); updateGarment(i, "color", ""); }}>
                  <option value="">Choose item…</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} — ${(p.price_cents / 100).toFixed(2)}</option>
                  ))}
                </select>
                {errorText(`garment-${i}-productId`)}
              </div>

              <div className="form-row">
                <div className="form-group"><label>Color</label>
                  {(() => {
                    const selectedProduct = productById(g.productId);
                    const availableColors = selectedProduct?.colors || [];
                    if (availableColors.length > 0) {
                      return (
                        <select value={g.color} onChange={(e) => updateGarment(i, "color", e.target.value)}>
                          <option value="">Choose color…</option>
                          {availableColors.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      );
                    }
                    return (
                      <input type="text" value={g.color} onChange={(e) => updateGarment(i, "color", e.target.value)} placeholder="e.g. Heather Gray" disabled={!g.productId} />
                    );
                  })()}
                  {errorText(`garment-${i}-color`)}
                </div>
                <div className="form-group"><label>Size</label>
                  <select value={g.size} onChange={(e) => updateGarment(i, "size", e.target.value)}>
                    <option value="">Choose size…</option>
                    {SIZE_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                  {errorText(`garment-${i}-size`)}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Fulfillment */}
        <div className="aform">
          <h3>Fulfillment</h3>
          <div className="form-row" style={{ marginBottom: "0" }}>
            <button type="button" className={form.fulfillment === "ship" ? "btn-primary" : "btn-outline"} onClick={() => updateField("fulfillment", "ship")}>Ship it to me</button>
            <button type="button" className={form.fulfillment === "pickup" ? "btn-primary" : "btn-outline"} onClick={() => updateField("fulfillment", "pickup")}>Local pickup</button>
          </div>

          {form.fulfillment === "ship" && (
            <div style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div className="form-group"><label>Address line 1</label>
                <input type="text" value={form.address.line1} onChange={(e) => updateAddress("line1", e.target.value)} />
                {errorText("line1")}
              </div>
              <div className="form-group"><label>Address line 2 (optional)</label>
                <input type="text" value={form.address.line2} onChange={(e) => updateAddress("line2", e.target.value)} />
              </div>
              <div className="form-row-3">
                <div className="form-group"><label>City</label>
                  <input type="text" value={form.address.city} onChange={(e) => updateAddress("city", e.target.value)} />
                  {errorText("city")}
                </div>
                <div className="form-group"><label>State</label>
                  <input type="text" value={form.address.state} onChange={(e) => updateAddress("state", e.target.value)} />
                  {errorText("state")}
                </div>
                <div className="form-group"><label>ZIP</label>
                  <input type="text" value={form.address.zip} onChange={(e) => updateAddress("zip", e.target.value)} />
                  {errorText("zip")}
                </div>
              </div>
            </div>
          )}
          {form.fulfillment === "pickup" && (
            <p style={{ fontSize: ".82rem", color: "var(--ink-muted)", marginTop: ".75rem" }}>
              Pickup available at Shop 1104, Indianola, IA — we'll text you when it's ready.
            </p>
          )}
        </div>

        <div style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 10, padding: "1rem", marginBottom: "1rem", fontSize: ".85rem", color: "var(--ink-soft)" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Subtotal ({form.garments.length} garment{form.garments.length > 1 ? "s" : ""})</span>
            <span>${(totalCents / 100).toFixed(2)}</span>
          </div>
          {collectPaymentNow && taxRatePercent > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Sales tax ({taxRatePercent}%)</span>
              <span>${((totalCents * taxRatePercent) / 100 / 100).toFixed(2)}</span>
            </div>
          )}
          {collectPaymentNow && feeRatePercent > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Card processing fee ({feeRatePercent}%)</span>
              <span>${((totalCents * feeRatePercent) / 100 / 100).toFixed(2)}</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, color: "var(--ink)", borderTop: "1px solid var(--border)", marginTop: ".5rem", paddingTop: ".5rem" }}>
            <span>{collectPaymentNow ? "Total due today" : "Estimated total"}</span>
            <span>${collectPaymentNow
              ? ((totalCents * (1 + taxRatePercent / 100 + feeRatePercent / 100)) / 100).toFixed(2)
              : (totalCents / 100).toFixed(2)}</span>
          </div>
          <p style={{ fontSize: ".72rem", marginTop: ".5rem", marginBottom: 0 }}>
            {collectPaymentNow ? "Shipping (if applicable) billed separately." : "A bill including tax and shipping will follow separately."}
          </p>
        </div>

        {submitError && (
          <p style={{ fontSize: ".82rem", textAlign: "center", background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 10, padding: ".6rem 1rem", color: "#c0392b", marginBottom: "1rem" }}>
            {submitError}
          </p>
        )}

        <button type="submit" disabled={submitting} className="btn-primary" style={{ width: "100%", textAlign: "center", opacity: submitting ? .7 : 1, cursor: submitting ? "not-allowed" : "pointer" }}>
          {submitting
            ? (collectPaymentNow ? "Redirecting to payment…" : "Submitting…")
            : (collectPaymentNow ? "Continue to Payment" : "Submit Pre-Order")}
        </button>
      </form>
    </div>
  );
}
