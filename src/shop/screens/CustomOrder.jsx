import { useState } from "react";
import * as api from "../api";

const GARMENT_TYPES = ["Tee", "Hoodie", "Crewneck", "Polo", "Hat", "Tote / Bag", "Other"];

export default function CustomOrder() {
  const [garmentType, setGarmentType] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const fd = new FormData(e.target);
    const fields = {
      fullName: fd.get("fullName"),
      email: fd.get("email"),
      phone: fd.get("phone"),
      address: fd.get("address"),
      garmentType: garmentType === "Other" ? fd.get("otherDesc") : garmentType,
      quantity: fd.get("quantity"),
      needBy: fd.get("needBy") || undefined,
      hasDesign: fd.get("hasDesign") === "yes",
    };
    setSubmitting(true);
    try {
      await api.submitCustomOrder(fields);
      setSubmitted(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="shop-section" style={{ maxWidth: 640 }}>
      <h1>Start a custom order</h1>
      <p className="text-muted">Need custom embroidery? Fill out the form below with the needed information and we will reach out with pricing and timing information. Thanks!</p>

      {submitted ? (
        <div className="card elev-sm" style={{ marginTop: 20 }}>
          <div className="card-title">Request received</div>
          <p className="card-body">Thanks — we'll be in touch shortly to talk through your order.</p>
          <button className="btn btn-secondary" style={{ alignSelf: "flex-start" }} onClick={() => { setSubmitted(false); setGarmentType(""); }}>Submit another request</button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 15, marginTop: 20 }}>
          {error && <p style={{ color: "var(--color-accent-2-700)" }}>{error}</p>}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 15 }}>
            <div className="field"><label>Full name *</label><input className="input" name="fullName" placeholder="Jordan Ramirez" required /></div>
            <div className="field"><label>Email *</label><input className="input" name="email" type="email" placeholder="jordan@email.com" required /></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 15 }}>
            <div className="field"><label>Phone number *</label><input className="input" name="phone" type="tel" placeholder="(555) 010-0199" required /></div>
            <div className="field"><label>Address *</label><input className="input" name="address" placeholder="123 Main St, Your City" required /></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 15 }}>
            <div className="field">
              <label>Garment type *</label>
              <select className="input" name="garmentType" value={garmentType} onChange={(e) => setGarmentType(e.target.value)} required>
                <option value="">Select a garment...</option>
                {GARMENT_TYPES.map((g) => <option key={g}>{g}</option>)}
              </select>
            </div>
            <div className="field"><label>Quantity of items *</label><input className="input" name="quantity" type="number" min="1" placeholder="e.g. 25" required /></div>
          </div>
          {garmentType === "Other" && (
            <div className="field"><label>Describe the garment *</label><input className="input" name="otherDesc" placeholder="Tell us what you need" required /></div>
          )}
          <div className="field">
            <label>
              Need it by a specific date?<br />
              <i style={{ color: "color-mix(in srgb, var(--color-text) 70%, transparent)" }}>
                For custom orders, we require a one month lead time from the initial request. Any items that are needed prior to one month from the request date will require a rush fee.
              </i>
            </label>
            <input className="input" name="needBy" type="date" />
          </div>
          <div className="field">
            <label>Are you providing a digitized logo or design?</label>
            <div className="seg" style={{ width: "fit-content" }}>
              <label className="seg-opt"><input type="radio" name="hasDesign" value="yes" />Yes, I have one</label>
              <label className="seg-opt"><input type="radio" name="hasDesign" value="no" />No, I need one made</label>
            </div>
          </div>
          <button className="btn btn-primary btn-block" type="submit" disabled={submitting}>
            {submitting ? "Submitting…" : "Submit request"}
          </button>
        </form>
      )}
    </section>
  );
}
