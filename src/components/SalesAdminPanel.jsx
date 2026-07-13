import { useState, useEffect } from "react";

/**
 * Shop 1104 — Sales & Pricing Admin Panel
 *
 * Rendered as its own standalone route (App.jsx returns it directly for
 * page === "salesadmin", before the main site's nav/CSS wrapper mounts).
 * Because of that, this component can't rely on the site's global styles
 * or Tailwind (which isn't installed here anyway) -- everything below is
 * plain inline styles so it always renders correctly on its own.
 */

const COLORS = {
  canvas: "#ebe8e8",
  card: "#FFFFFF",
  ink: "#1e1e1e",
  inkSoft: "#4A5A6A",
  line: "#DDD8CC",
  green: "#52805f",
  greenDark: "#3f6249",
  gold: "#B8902E",
  red: "#c0392b",
};

const fontBody = "'Jost', Arial, sans-serif";
const fontDisplay = "'DM Serif Display', Georgia, serif";

function authHeaders(code) {
  return { "Content-Type": "application/json", "x-admin-code": code };
}

export default function SalesAdminPanel() {
  const [adminCode, setAdminCode] = useState("");
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState("");

  const [sales, setSales] = useState([]);
  const [selectedSaleId, setSelectedSaleId] = useState(null);
  const [products, setProducts] = useState([]);
  const [newSaleName, setNewSaleName] = useState("");

  const [newProductName, setNewProductName] = useState("");
  const [newProductPrice, setNewProductPrice] = useState("");
  const [editingProductId, setEditingProductId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");

  const selectedSale = sales.find((s) => s.id === selectedSaleId) || null;

  const loadSales = async (code) => {
    try {
      const res = await fetch("/.netlify/functions/admin-sales", { headers: authHeaders(code) });
      if (!res.ok) throw new Error("Could not load sales.");
      const data = await res.json();
      setSales(data.sales || []);
      if (data.sales && data.sales.length > 0 && !selectedSaleId) setSelectedSaleId(data.sales[0].id);
    } catch (err) {
      setAuthError(err.message);
    }
  };

  const loadProducts = async (saleId, code) => {
    if (!saleId) return;
    const res = await fetch(`/.netlify/functions/admin-products?saleId=${saleId}`, { headers: authHeaders(code) });
    if (res.ok) { const data = await res.json(); setProducts(data.products || []); }
  };

  useEffect(() => {
    if (authed && selectedSaleId) loadProducts(selectedSaleId, adminCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed, selectedSaleId]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError("");
    const res = await fetch("/.netlify/functions/admin-sales", { headers: authHeaders(adminCode) });
    if (res.status === 401) { setAuthError("Incorrect admin code."); return; }
    if (!res.ok) { setAuthError("Could not connect. Try again."); return; }
    const data = await res.json();
    setSales(data.sales || []);
    if (data.sales && data.sales.length > 0) setSelectedSaleId(data.sales[0].id);
    setAuthed(true);
  };

  const createSale = async () => {
    if (!newSaleName.trim()) return;
    const res = await fetch("/.netlify/functions/admin-sales", {
      method: "POST", headers: authHeaders(adminCode),
      body: JSON.stringify({ action: "create", name: newSaleName.trim() }),
    });
    if (res.ok) { setNewSaleName(""); await loadSales(adminCode); }
  };

  const activateSale = async (saleId) => {
    const res = await fetch("/.netlify/functions/admin-sales", {
      method: "POST", headers: authHeaders(adminCode),
      body: JSON.stringify({ action: "activate", saleId }),
    });
    if (res.ok) await loadSales(adminCode);
  };

  const deleteSale = async (saleId) => {
    if (!window.confirm("Delete this sale and all its items? This can't be undone.")) return;
    const res = await fetch("/.netlify/functions/admin-sales", {
      method: "POST", headers: authHeaders(adminCode),
      body: JSON.stringify({ action: "delete", saleId }),
    });
    if (res.ok) { if (selectedSaleId === saleId) setSelectedSaleId(null); await loadSales(adminCode); }
  };

  const createProduct = async () => {
    if (!newProductName.trim() || !newProductPrice) return;
    const priceCents = Math.round(parseFloat(newProductPrice) * 100);
    if (!Number.isFinite(priceCents) || priceCents <= 0) return;
    const res = await fetch("/.netlify/functions/admin-products", {
      method: "POST", headers: authHeaders(adminCode),
      body: JSON.stringify({ action: "create", saleId: selectedSaleId, name: newProductName.trim(), priceCents }),
    });
    if (res.ok) { setNewProductName(""); setNewProductPrice(""); await loadProducts(selectedSaleId, adminCode); }
  };

  const startEdit = (product) => {
    setEditingProductId(product.id);
    setEditName(product.name);
    setEditPrice((product.price_cents / 100).toFixed(2));
  };

  const saveEdit = async (productId) => {
    const priceCents = Math.round(parseFloat(editPrice) * 100);
    const res = await fetch("/.netlify/functions/admin-products", {
      method: "POST", headers: authHeaders(adminCode),
      body: JSON.stringify({ action: "update", productId, name: editName.trim(), priceCents }),
    });
    if (res.ok) { setEditingProductId(null); await loadProducts(selectedSaleId, adminCode); }
  };

  const deleteProduct = async (productId) => {
    if (!window.confirm("Delete this item?")) return;
    const res = await fetch("/.netlify/functions/admin-products", {
      method: "POST", headers: authHeaders(adminCode),
      body: JSON.stringify({ action: "delete", productId }),
    });
    if (res.ok) await loadProducts(selectedSaleId, adminCode);
  };

  const inputStyle = { padding: ".65rem .9rem", border: `1.5px solid ${COLORS.line}`, borderRadius: 8, background: "#FFFFFF", color: COLORS.ink, fontFamily: fontBody, fontSize: ".92rem", outline: "none", width: "100%" };
  const buttonPrimary = { padding: ".65rem 1.25rem", background: COLORS.green, color: "#FFFFFF", border: "none", borderRadius: 100, fontFamily: fontBody, fontSize: ".8rem", fontWeight: 600, letterSpacing: ".05em", textTransform: "uppercase", cursor: "pointer" };
  const buttonGhost = { padding: ".4rem .9rem", background: "transparent", color: COLORS.inkSoft, border: `1.5px solid ${COLORS.line}`, borderRadius: 100, fontFamily: fontBody, fontSize: ".72rem", cursor: "pointer" };
  const buttonDanger = { ...buttonGhost, color: COLORS.red, borderColor: "#e8a0a0" };

  if (!authed) {
    return (
      <div style={{ minHeight: "100vh", width: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem", background: COLORS.canvas, fontFamily: fontBody }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Jost:wght@400;500;600&display=swap');`}</style>
        <form onSubmit={handleLogin} style={{ maxWidth: 380, width: "100%", borderRadius: 16, padding: "2rem", background: COLORS.card, border: `1px solid ${COLORS.line}` }}>
          <h1 style={{ fontFamily: fontDisplay, fontSize: "1.4rem", color: COLORS.ink, marginBottom: "1.25rem" }}>Sales &amp; Pricing Admin</h1>
          <input
            type="password" value={adminCode} onChange={(e) => setAdminCode(e.target.value)}
            placeholder="Admin code" style={{ ...inputStyle, marginBottom: "1rem" }}
          />
          {authError && <p style={{ fontSize: ".8rem", color: COLORS.red, marginBottom: "1rem" }}>{authError}</p>}
          <button type="submit" style={{ ...buttonPrimary, width: "100%" }}>Enter</button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", width: "100%", padding: "1.5rem", background: COLORS.canvas, fontFamily: fontBody }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Jost:wght@400;500;600&display=swap');`}</style>
      <div style={{ maxWidth: 1000, margin: "0 auto", display: "grid", gridTemplateColumns: "300px 1fr", gap: "1.5rem" }}>
        {/* Sales list */}
        <div>
          <h2 style={{ fontFamily: fontDisplay, fontSize: "1.1rem", color: COLORS.ink, marginBottom: ".75rem" }}>Sales</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: ".5rem", marginBottom: "1rem" }}>
            {sales.map((s) => (
              <div key={s.id} onClick={() => setSelectedSaleId(s.id)}
                style={{ borderRadius: 10, padding: ".75rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between",
                  background: s.id === selectedSaleId ? COLORS.card : "transparent",
                  border: `1px solid ${s.id === selectedSaleId ? COLORS.ink : COLORS.line}` }}>
                <div>
                  <p style={{ fontSize: ".9rem", fontWeight: 500, color: COLORS.ink }}>{s.name}</p>
                  <p style={{ fontSize: ".75rem", color: s.is_active ? COLORS.green : COLORS.inkSoft }}>{s.is_active ? "● Active" : "Inactive"}</p>
                </div>
                <button onClick={(e) => { e.stopPropagation(); deleteSale(s.id); }} style={{ background: "none", border: "none", color: COLORS.inkSoft, cursor: "pointer", fontSize: ".85rem" }}>✕</button>
              </div>
            ))}
            {sales.length === 0 && <p style={{ fontSize: ".8rem", color: COLORS.inkSoft }}>No sales yet — create one below.</p>}
          </div>
          <div style={{ display: "flex", gap: ".5rem" }}>
            <input type="text" value={newSaleName} onChange={(e) => setNewSaleName(e.target.value)} placeholder="New sale name" style={inputStyle} />
            <button onClick={createSale} style={buttonPrimary}>+</button>
          </div>
        </div>

        {/* Products */}
        <div>
          {selectedSale ? (
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: ".75rem" }}>
                <h2 style={{ fontFamily: fontDisplay, fontSize: "1.1rem", color: COLORS.ink }}>Items in "{selectedSale.name}"</h2>
                {!selectedSale.is_active && (
                  <button onClick={() => activateSale(selectedSale.id)} style={{ ...buttonPrimary, background: COLORS.green }}>Set as active sale</button>
                )}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: ".5rem", marginBottom: "1rem" }}>
                {products.map((p) => (
                  <div key={p.id} style={{ borderRadius: 10, padding: ".75rem", display: "flex", alignItems: "center", justifyContent: "space-between", background: COLORS.card, border: `1px solid ${COLORS.line}` }}>
                    {editingProductId === p.id ? (
                      <div style={{ display: "flex", alignItems: "center", gap: ".5rem", flex: 1 }}>
                        <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                        <input type="number" step="0.01" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} style={{ ...inputStyle, width: 100 }} />
                        <button onClick={() => saveEdit(p.id)} style={{ background: "none", border: "none", color: COLORS.green, cursor: "pointer", fontSize: "1.1rem" }}>✓</button>
                        <button onClick={() => setEditingProductId(null)} style={{ background: "none", border: "none", color: COLORS.inkSoft, cursor: "pointer", fontSize: "1.1rem" }}>✕</button>
                      </div>
                    ) : (
                      <>
                        <div>
                          <p style={{ fontSize: ".9rem", color: COLORS.ink }}>{p.name}</p>
                          <p style={{ fontSize: ".8rem", color: COLORS.gold }}>${(p.price_cents / 100).toFixed(2)}</p>
                        </div>
                        <div style={{ display: "flex", gap: ".75rem" }}>
                          <button onClick={() => startEdit(p)} style={{ background: "none", border: "none", color: COLORS.inkSoft, cursor: "pointer" }}>Edit</button>
                          <button onClick={() => deleteProduct(p.id)} style={{ background: "none", border: "none", color: COLORS.inkSoft, cursor: "pointer" }}>Remove</button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
                {products.length === 0 && <p style={{ fontSize: ".8rem", color: COLORS.inkSoft }}>No items yet — add one below.</p>}
              </div>

              <div style={{ display: "flex", gap: ".5rem" }}>
                <input type="text" value={newProductName} onChange={(e) => setNewProductName(e.target.value)} placeholder="Item name (e.g. Tee — Indianola Logo)" style={{ ...inputStyle, flex: 1 }} />
                <input type="number" step="0.01" value={newProductPrice} onChange={(e) => setNewProductPrice(e.target.value)} placeholder="Price" style={{ ...inputStyle, width: 100 }} />
                <button onClick={createProduct} style={buttonPrimary}>+</button>
              </div>
            </>
          ) : (
            <p style={{ fontSize: ".9rem", color: COLORS.inkSoft }}>Select or create a sale to manage its items.</p>
          )}
        </div>
      </div>
    </div>
  );
}
