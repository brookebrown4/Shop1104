import { useState } from "react";
import * as api from "../api";

export default function ClientPortal({ portal, setPortal, onOpenProduct, cart }) {
  const [submitting, setSubmitting] = useState(false);

  // A single order can only be priced against one product set -- Main Shop
  // or one portal, never mixed (see submit-general-order.cjs). Switching
  // context with items already in the cart would otherwise silently break
  // checkout, so the cart resets on the way in and out of a portal.
  const handleLogin = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const code = (fd.get("code") || "").trim().toUpperCase();
    const password = fd.get("password") || "";
    setSubmitting(true);
    try {
      const r = await api.getPortal(code, password);
      if (r.error || !r.portal) {
        setPortal((p) => ({ ...p, error: r.error || "No store found for that code." }));
      } else {
        if (cart.cart.length > 0) cart.clear();
        setPortal({ loggedIn: true, code: r.portal.code, name: r.portal.name, error: "", products: r.products });
      }
    } catch (err) {
      setPortal((p) => ({ ...p, error: err.message }));
    } finally {
      setSubmitting(false);
    }
  };

  const signOut = () => {
    if (cart.cart.length > 0) cart.clear();
    setPortal({ loggedIn: false, code: "", name: "", error: "" });
  };

  if (portal.loggedIn) {
    const products = portal.products || [];
    return (
      <section className="shop-section">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <h1>{portal.name} — Team Store</h1>
          <a href="#" onClick={(e) => { e.preventDefault(); signOut(); }}>Sign out</a>
        </div>
        <p className="text-muted" style={{ marginTop: -4 }}>Curated gear and pricing for your team.</p>
        {products.length === 0 ? (
          <p className="text-muted" style={{ marginTop: 20 }}>No products have been added to this store yet.</p>
        ) : (
          <div className="grid-3" style={{ marginTop: 20 }}>
            {products.map((p) => (
              <div key={p.id} className="card" style={{ padding: 0, background: "transparent", gap: 10, cursor: "pointer" }} onClick={() => onOpenProduct(p.id)}>
                <div className="halftone" style={{ width: "100%", aspectRatio: "1/1" }}>{p.image ? <img src={p.image} alt={p.name} /> : `${p.name} photo`}</div>
                <div className="card-title">{p.name}</div>
                <div className="card-meta">
                  <span className="tag tag-accent">Customizable</span>
                  {p.soldOut && <span className="tag tag-neutral">Sold out</span>}
                  <span>${(p.price_cents / 100).toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="shop-section">
      <h6 style={{ color: "var(--color-accent-700)" }}>For businesses &amp; teams</h6>
      <h1>Client Portal</h1>
      <div className="grid-2" style={{ alignItems: "center", marginTop: 15 }}>
        <div>
          <p style={{ fontSize: 17, maxWidth: 480, opacity: 0.85 }}>
            A dedicated, always-open store for your company or team. We set it up with your logo, your approved gear and your
            pricing — your people order what they need, whenever they need it. Businesses that want one can require a password
            to sign in.
          </p>
        </div>
        <div className="halftone" style={{ width: "100%", aspectRatio: "4/3" }}>Business/team ordering photo</div>
      </div>

      <div style={{ marginTop: 40, maxWidth: 640 }}>
        <h2>Sign in to a client store</h2>
        {portal.error && <p style={{ color: "var(--color-accent-2-700)" }}>{portal.error}</p>}
        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 15, marginTop: 15 }}>
          <div className="field"><label>Store access code</label><input className="input" name="code" placeholder="e.g. ACME" required /></div>
          <div className="field"><label>Password (if your store requires one)</label><input className="input" name="password" type="password" placeholder="Leave blank if none" /></div>
          <button className="btn btn-primary" type="submit" style={{ alignSelf: "flex-start" }} disabled={submitting}>
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </section>
  );
}
