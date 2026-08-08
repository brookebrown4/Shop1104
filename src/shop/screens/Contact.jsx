import { useState } from "react";
import * as api from "../api";

export default function Contact() {
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
      orderNumber: fd.get("orderNumber") || undefined,
      message: fd.get("message"),
    };
    setSubmitting(true);
    try {
      await api.submitContact(fields);
      setSubmitted(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="shop-section" style={{ maxWidth: 640 }}>
      <h1>Contact us</h1>
      <p className="text-muted">Question about an order, a product, or anything else? Send us a note and we'll get back to you.</p>

      {submitted ? (
        <div className="card elev-sm" style={{ marginTop: 20 }}>
          <div className="card-title">Message sent</div>
          <p className="card-body">Thanks for reaching out — we'll respond as soon as we can.</p>
          <button className="btn btn-secondary" style={{ alignSelf: "flex-start" }} onClick={() => setSubmitted(false)}>Send another message</button>
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
            <div className="field"><label>Order number</label><input className="input" name="orderNumber" placeholder="e.g. S1104-4821 (if applicable)" /></div>
          </div>
          <div className="field"><label>What can we help with? *</label><textarea className="input" name="message" placeholder="Tell us what's going on" required /></div>
          <button className="btn btn-primary btn-block" type="submit" disabled={submitting}>
            {submitting ? "Sending…" : "Send message"}
          </button>
        </form>
      )}
    </section>
  );
}
