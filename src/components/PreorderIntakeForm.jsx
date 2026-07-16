import { useState, useEffect } from "react";

/**
 * Shop 1104 — Pre-Order Intake Form
 *
 * Props:
 *   slug         - optional, from the URL (/preorder/some-slug). If given,
 *                  loads that specific sale. If omitted, loads whichever
 *                  single sale is active, or shows a picker if more than
 *                  one sale is active at once.
 *   onChooseSlug - called with a slug when the customer picks a sale from
 *                  that picker, so the parent can update the URL.
 *
 * Each product can define its own sizes, colors, and logos/designs, each
 * optionally with an extra cost added to the base price. If a product
 * doesn't define a given option list, that choice is simply skipped.
 */

const FALLBACK_SIZES = [
  "Youth S","Youth M","Youth L",
  "Adult S","Adult M","Adult L","Adult XL","Adult 2XL","Adult 3XL","Adult 4XL",
];

const emptyGarment = () => ({ productId: "", color: "", size: "", logo: "" });
const emptyForm = {
  name: "", email: "", phone: "",
  garments: [emptyGarment()],
  fulfillment: "ship",
  address: { line1: "", line2: "", city: "", state: "", zip: "" },
};

function optionCostLabel(extraCost) {
  if (!extraCost) return "";
  return ` (+$${(extraCost / 100).toFixed(2)})`;
}

export default function PreorderIntakeForm({ slug, onChooseSlug }) {
  const [loadingSale, setLoadingSale] = useState(true);
  const [sale, setSale] = useState(null);
  const [products, setProducts] = useState([]);
  const [multipleSales, setMultipleSales] = useState(null);
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
    setLoadingSale(true);
    setMultipleSales(null);
    setLoadError("");
    const url = slug
      ? `/.netlify/functions/get-active-sale?slug=${encodeURIComponent(slug)}`
      : "/.netlify/functions/get-active-sale";
    fetch(url)
      .then((res) => { if (!res.ok) throw new Error("Could not load current sale."); return res.json(); })
      .then((data) => {
        if (cancelled) return;
        if (data.multipleSales) {
          setMultipleSales(data.multipleSales);
        } else {
          setSale(data.sale);
          setProducts(data.products || []);
        }
        setTaxRatePercent(data.taxRatePercent || 0);
        setFeeRatePercent(data.feeRatePercent || 0);
        setCollectPaymentNow(data.collectPaymentNow !== false);
      })
      .catch((err) => { if (cancelled) return; setLoadError(err.message || "Could not load current sale."); })
      .finally(() => { if (!cancelled) setLoadingSale(false); });
    return () => { cancelled = true; };
  }, [slug]);

  const productById = (id) => products.find((p) => p.id === id);
  const updateField = (field, value) => setForm((f) => ({ ...f, [field]: value }));
  const updateAddress = (field, value) => setForm((f) => ({ ...f, address: { ...f.address, [field]: value } }));
  const updateGarment = (index, field, value) =>
    setForm((f) => { const garments = [...f.garments]; garments[index] = { ...garments[index], [field]: value }; return { ...f, garments }; });
  const addGarment = () => setForm((f) => ({ ...f, garments: [...f.garments, emptyGarment()] }));
  const removeGarment = (index) =>
    setForm((f) => ({ ...f, garments: f.garments.length > 1 ? f.garments.filter((_, i) => i !== index) : f.garments }));

  // Computes one garment's full price: base + size extra + color extra + logo extra.
  const garmentPriceCents = (g) => {
    const product = productById(g.productId);
    if (!product) return 0;
    let total = product.price_cents;
    const size = (product.sizes || []).find((s) => s.name === g.size);
    if (size) total += size.extraCost || 0;
    const color = (product.colors || []).find((c) => c.name === g.color);
    if (color) total += color.extraCost || 0;
    const logo = (product.logos || []).find((l) => l.name === g.logo);
    if (logo) total += logo.extraCost || 0;
    return total;
  };

  const totalCents = form.garments.reduce((sum, g) => sum + garmentPriceCents(g), 0);

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = "Name is required.";
    if (!form.email.trim()) errs.email = "Email is required.";
    else if (!/^\S+@\S+\.\S+$/.test(form.email)) errs.email = "Enter a valid email.";
    if (!form.phone.trim()) errs.phone = "Phone number is required.";
    form.garments.forEach((g, i) => {
      const product = productById(g.productId);
      if (!product) { errs[`garment-${i}-productId`] = "Choose an item."; return; }
      if (!g.size) errs[`garment-${i}-size`] = "Pick a size.";
      if ((product.colors || []).length > 0 && !g.color) errs[`garment-${i}-color`] = "Choose a color.";
      if ((product.logos || []).length > 0 && !g.logo) errs[`garment-${i}-logo`] = "Choose a logo/design.";
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
      garments: form.garments.map((g) => ({ productId: g.productId, color: g.color, size: g.size, logo: g.logo })),
      fulfillment: form.fulfillment, address: form.address,
    };
    try {
      const orderRes = await fetch("/.netlify/functions/submit-order", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      if (!orderRes.ok) { const err = await orderRes.json().catch(() => ({})); throw new Error(err.error || "Could not save your order. Please try again."); }
      const { orderId } = await orderRes.json();

      if (!collectPaymentNow) {
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

  if (multipleSales) {
    return (
      <div className="section">
        <p className="section-label">Pre-Order</p>
        <h2 className="section-title" style={{ marginBottom: "1rem" }}>Choose a pre-order</h2>
        <p className="section-body" style={{ marginBottom: "1.5rem" }}>More than one pre-order is running right now — pick one below.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: ".75rem", maxWidth: 420 }}>
          {multipleSales.map((s) => (
            <button key={s.slug} type="button" className="btn-outline" onClick={() => onChooseSlug && onChooseSlug(s.slug)}>
              {s.name}
            </button>
          ))}
        </div>
      </div>
    );
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

          {form.garments.map((g, i) => {
            const product = productById(g.productId);
            const sizeOptions = product && product.sizes && product.sizes.length > 0 ? product.sizes : null;
            const colorOptions = product ? product.colors || [] : [];
            const logoOptions = product ? product.logos || [] : [];
            return (
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
                  <select value={g.productId} onChange={(e) => { updateGarment(i, "productId", e.target.value); updateGarment(i, "color", ""); updateGarment(i, "size", ""); updateGarment(i, "logo", ""); }}>
                    <option value="">Choose item…</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.name} — ${(p.price_cents / 100).toFixed(2)}</option>
                    ))}
                  </select>
                  {errorText(`garment-${i}-productId`)}
                </div>

                {product && product.image && (
                  <div style={{ marginBottom: ".75rem" }}>
                    <img src={product.image} alt={product.name} style={{ width: "100%", maxHeight: 180, objectFit: "cover", borderRadius: 8 }} />
                  </div>
                )}

                {product && logoOptions.length > 0 && (
                  <div className="form-group" style={{ marginBottom: ".75rem" }}>
                    <label>Logo / Design</label>
                    <select value={g.logo} onChange={(e) => updateGarment(i, "logo", e.target.value)}>
                      <option value="">Choose logo/design…</option>
                      {logoOptions.map((l) => <option key={l.name} value={l.name}>{l.name}{optionCostLabel(l.extraCost)}</option>)}
                    </select>
                    {errorText(`garment-${i}-logo`)}
                  </div>
                )}

                <div className="form-row">
                  <div className="form-group"><label>Color</label>
                    {colorOptions.length > 0 ? (
                      <select value={g.color} onChange={(e) => updateGarment(i, "color", e.target.value)}>
                        <option value="">Choose color…</option>
                        {colorOptions.map((c) => <option key={c.name} value={c.name}>{c.name}{optionCostLabel(c.extraCost)}</option>)}
                      </select>
                    ) : (
                      <input type="text" value={g.color} onChange={(e) => updateGarment(i, "color", e.target.value)} placeholder="e.g. Heather Gray" disabled={!g.productId} />
                    )}
                    {errorText(`garment-${i}-color`)}
                  </div>
                  <div className="form-group"><label>Size</label>
                    <select value={g.size} onChange={(e) => updateGarment(i, "size", e.target.value)}>
                      <option value="">Choose size…</option>
                      {(sizeOptions || FALLBACK_SIZES.map((n) => ({ name: n, extraCost: 0 }))).map((s) => (
                        <option key={s.name} value={s.name}>{s.name}{optionCostLabel(s.extraCost)}</option>
                      ))}
                    </select>
                    {errorText(`garment-${i}-size`)}
                  </div>
                </div>

                {product && (
                  <p style={{ fontSize: ".78rem", color: "var(--ink-muted)", marginTop: ".6rem", textAlign: "right" }}>
                    Line price: ${(garmentPriceCents(g) / 100).toFixed(2)}
                  </p>
                )}
              </div>
            );
          })}
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
