import { useState, useEffect } from "react";

/**
 * Shop 1104 — Sales & Pricing Admin Panel
 *
 * Standalone route (no Tailwind, no reliance on the main site's global
 * styles) -- everything here is plain inline styles so it always renders
 * correctly on its own.
 *
 * Supports:
 *  - Multiple sales active at the same time, each with its own shareable
 *    link (/preorder/<slug>)
 *  - Renaming a sale (the link/slug stays the same so shared links don't break)
 *  - Per-product sizes, colors, and logos/designs, each optionally with its
 *    own extra cost added on top of the base price
 *  - A photo per product
 */

const COLORS = {
  canvas: "#ebe8e8", card: "#FFFFFF", ink: "#1e1e1e", inkSoft: "#4A5A6A",
  line: "#DDD8CC", green: "#52805f", gold: "#B8902E", red: "#c0392b",
};
const fontBody = "'Jost', Arial, sans-serif";
const fontDisplay = "'DM Serif Display', Georgia, serif";

function authHeaders(code) {
  return { "Content-Type": "application/json", "x-admin-code": code };
}

function resizeImage(file, cb) {
  const reader = new FileReader();
  reader.onload = (ev) => {
    const img = new Image();
    img.onload = () => {
      const max = 800;
      const canvas = document.createElement("canvas");
      let w = img.width, h = img.height;
      if (w > max) { h = Math.round((h * max) / w); w = max; }
      if (h > max) { w = Math.round((w * max) / h); h = max; }
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      cb(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}

const emptyOption = () => ({ name: "", extraCost: "" });
const emptyNewProduct = { name: "", price: "", image: "", sizes: [], colors: [], logos: [], customTextEnabled: false, customTextLabel: "Custom Name" };

// Shared styles -- module scope so they're never recreated on re-render.
const inputStyle = { padding: ".6rem .8rem", border: `1.5px solid ${COLORS.line}`, borderRadius: 8, background: "#FFFFFF", color: COLORS.ink, fontFamily: fontBody, fontSize: ".88rem", outline: "none", width: "100%" };
const buttonPrimary = { padding: ".6rem 1.1rem", background: COLORS.green, color: "#FFFFFF", border: "none", borderRadius: 100, fontFamily: fontBody, fontSize: ".78rem", fontWeight: 600, letterSpacing: ".05em", textTransform: "uppercase", cursor: "pointer" };
const buttonGhost = { padding: ".35rem .8rem", background: "transparent", color: COLORS.inkSoft, border: `1.5px solid ${COLORS.line}`, borderRadius: 100, fontFamily: fontBody, fontSize: ".7rem", cursor: "pointer" };
const buttonDanger = { ...buttonGhost, color: COLORS.red, borderColor: "#e8a0a0" };
const smallLabel = { fontSize: ".68rem", letterSpacing: ".08em", textTransform: "uppercase", color: COLORS.inkSoft, fontWeight: 600, marginBottom: ".3rem", display: "block" };

// Pure helpers -- don't depend on component state, so they live at module scope too.
function addOptionToDraft(listSetter, list, draft, draftSetter) {
  if (!draft.name.trim()) return;
  listSetter([...list, { name: draft.name.trim(), extraCost: draft.extraCost }]);
  draftSetter(emptyOption());
}
function removeOptionAt(listSetter, list, idx) {
  listSetter(list.filter((_, i) => i !== idx));
}

// Renders the add/edit UI for one option list (sizes, colors, or logos).
// IMPORTANT: this must be defined here, at module scope -- NOT inside the
// SalesAdminPanel component -- or React treats it as a brand-new component
// on every re-render (e.g. every keystroke) and throws away the input's
// focus, which is exactly the "only lets me type one character" bug.
function OptionListEditor({ title, hint, list, setList, draft, setDraft }) {
  return (
    <div style={{ marginTop: ".85rem", padding: "1rem", background: COLORS.canvas, borderRadius: 10, border: `1px solid ${COLORS.line}` }}>
      <span style={smallLabel}>{title}</span>
      {hint && <p style={{ fontSize: ".72rem", color: COLORS.inkSoft, marginBottom: ".6rem" }}>{hint}</p>}
      {list.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: ".4rem", marginBottom: ".6rem" }}>
          {list.map((opt, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: ".45rem .7rem", background: COLORS.card, borderRadius: 6, border: `1px solid ${COLORS.line}` }}>
              <span style={{ fontSize: ".82rem", color: COLORS.ink }}>{opt.name}</span>
              <div style={{ display: "flex", alignItems: "center", gap: ".6rem" }}>
                <span style={{ fontSize: ".76rem", color: COLORS.gold }}>{opt.extraCost ? `+$${Number(opt.extraCost).toFixed(2)}` : "no extra cost"}</span>
                <button type="button" onClick={() => removeOptionAt(setList, list, i)} style={{ background: "none", border: "none", color: COLORS.inkSoft, cursor: "pointer" }}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: "flex", gap: ".5rem" }}>
        <input type="text" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Name (e.g. Adult L)" style={{ ...inputStyle, flex: 1 }} />
        <input type="number" step="0.01" value={draft.extraCost} onChange={(e) => setDraft({ ...draft, extraCost: e.target.value })} placeholder="+$0.00" style={{ ...inputStyle, width: 90 }} />
        <button type="button" onClick={() => addOptionToDraft(setList, list, draft, setDraft)} style={buttonGhost}>+ Add</button>
      </div>
    </div>
  );
}

export default function SalesAdminPanel() {
  const [adminCode, setAdminCode] = useState("");
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState("");

  const [sales, setSales] = useState([]);
  const [selectedSaleId, setSelectedSaleId] = useState(null);
  const [products, setProducts] = useState([]);
  const [newSaleName, setNewSaleName] = useState("");
  const [renamingSaleId, setRenamingSaleId] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [copiedSlug, setCopiedSlug] = useState("");

  const [newProduct, setNewProduct] = useState(emptyNewProduct);
  const [newSizeDraft, setNewSizeDraft] = useState(emptyOption());
  const [newColorDraft, setNewColorDraft] = useState(emptyOption());
  const [newLogoDraft, setNewLogoDraft] = useState(emptyOption());

  const [editingProductId, setEditingProductId] = useState(null);
  const [editProduct, setEditProduct] = useState(null);
  const [editSizeDraft, setEditSizeDraft] = useState(emptyOption());
  const [editColorDraft, setEditColorDraft] = useState(emptyOption());
  const [editLogoDraft, setEditLogoDraft] = useState(emptyOption());

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

  const toggleActive = async (sale) => {
    const res = await fetch("/.netlify/functions/admin-sales", {
      method: "POST", headers: authHeaders(adminCode),
      body: JSON.stringify({ action: sale.is_active ? "deactivate" : "activate", saleId: sale.id }),
    });
    if (res.ok) await loadSales(adminCode);
  };

  const saveRename = async (saleId) => {
    if (!renameValue.trim()) return;
    const res = await fetch("/.netlify/functions/admin-sales", {
      method: "POST", headers: authHeaders(adminCode),
      body: JSON.stringify({ action: "rename", saleId, name: renameValue.trim() }),
    });
    if (res.ok) { setRenamingSaleId(null); await loadSales(adminCode); }
  };

  const duplicateSale = async (sale) => {
    const suggested = `${sale.name} (Copy)`;
    const name = window.prompt("Name for the new sale:", suggested);
    if (!name) return;
    const res = await fetch("/.netlify/functions/admin-sales", {
      method: "POST", headers: authHeaders(adminCode),
      body: JSON.stringify({ action: "duplicate", saleId: sale.id, name }),
    });
    if (res.ok) {
      const data = await res.json();
      await loadSales(adminCode);
      if (data.sale) setSelectedSaleId(data.sale.id);
    }
  };

  const deleteSale = async (saleId) => {
    if (!window.confirm("Delete this sale and all its items? This can't be undone.")) return;
    const res = await fetch("/.netlify/functions/admin-sales", {
      method: "POST", headers: authHeaders(adminCode),
      body: JSON.stringify({ action: "delete", saleId }),
    });
    if (res.ok) { if (selectedSaleId === saleId) setSelectedSaleId(null); await loadSales(adminCode); }
  };

  const copyLink = (slug) => {
    const link = `${window.location.origin}/preorder/${slug}`;
    if (navigator.clipboard) navigator.clipboard.writeText(link).catch(() => {});
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(""), 1500);
  };

  // ── Product option-list helpers (sizes/colors/logos), shared by create & edit ──

  const createProduct = async () => {
    if (!newProduct.name.trim() || !newProduct.price) return;
    const priceCents = Math.round(parseFloat(newProduct.price) * 100);
    if (!Number.isFinite(priceCents) || priceCents <= 0) return;
    const res = await fetch("/.netlify/functions/admin-products", {
      method: "POST", headers: authHeaders(adminCode),
      body: JSON.stringify({
        action: "create", saleId: selectedSaleId, name: newProduct.name.trim(), priceCents,
        sizes: newProduct.sizes, colors: newProduct.colors, logos: newProduct.logos, image: newProduct.image,
        customTextEnabled: newProduct.customTextEnabled, customTextLabel: newProduct.customTextLabel,
      }),
    });
    if (res.ok) { setNewProduct(emptyNewProduct); await loadProducts(selectedSaleId, adminCode); }
  };

  const startEdit = (p) => {
    setEditingProductId(p.id);
    setEditProduct({
      name: p.name, price: (p.price_cents / 100).toFixed(2), image: p.image_data || "",
      sizes: (p.sizes || []).map((s) => ({ name: s.name, extraCost: s.extraCost ? (s.extraCost / 100).toFixed(2) : "" })),
      colors: (p.colors || []).map((c) => ({ name: c.name, extraCost: c.extraCost ? (c.extraCost / 100).toFixed(2) : "" })),
      logos: (p.logos || []).map((l) => ({ name: l.name, extraCost: l.extraCost ? (l.extraCost / 100).toFixed(2) : "" })),
      customTextEnabled: !!p.custom_text_enabled, customTextLabel: p.custom_text_label || "Custom Name",
    });
  };

  const saveEdit = async (productId) => {
    const priceCents = Math.round(parseFloat(editProduct.price) * 100);
    const res = await fetch("/.netlify/functions/admin-products", {
      method: "POST", headers: authHeaders(adminCode),
      body: JSON.stringify({
        action: "update", productId, name: editProduct.name.trim(), priceCents,
        sizes: editProduct.sizes, colors: editProduct.colors, logos: editProduct.logos, image: editProduct.image,
        customTextEnabled: editProduct.customTextEnabled, customTextLabel: editProduct.customTextLabel,
      }),
    });
    if (res.ok) { setEditingProductId(null); setEditProduct(null); await loadProducts(selectedSaleId, adminCode); }
  };

  const moveProduct = async (productId, targetSaleId) => {
    if (!targetSaleId) return;
    const res = await fetch("/.netlify/functions/admin-products", {
      method: "POST", headers: authHeaders(adminCode),
      body: JSON.stringify({ action: "move", productId, targetSaleId }),
    });
    if (res.ok) await loadProducts(selectedSaleId, adminCode);
  };

  const deleteProduct = async (productId) => {
    if (!window.confirm("Delete this item?")) return;
    const res = await fetch("/.netlify/functions/admin-products", {
      method: "POST", headers: authHeaders(adminCode),
      body: JSON.stringify({ action: "delete", productId }),
    });
    if (res.ok) await loadProducts(selectedSaleId, adminCode);
  };

  // (styles and OptionListEditor now live at module scope, above)

  if (!authed) {
    return (
      <div style={{ minHeight: "100vh", width: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem", background: COLORS.canvas, fontFamily: fontBody }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Jost:wght@400;500;600&display=swap');`}</style>
        <form onSubmit={handleLogin} style={{ maxWidth: 380, width: "100%", borderRadius: 16, padding: "2rem", background: COLORS.card, border: `1px solid ${COLORS.line}` }}>
          <h1 style={{ fontFamily: fontDisplay, fontSize: "1.4rem", color: COLORS.ink, marginBottom: "1.25rem" }}>Sales &amp; Pricing Admin</h1>
          <input type="password" value={adminCode} onChange={(e) => setAdminCode(e.target.value)} placeholder="Admin code" style={{ ...inputStyle, marginBottom: "1rem" }} />
          {authError && <p style={{ fontSize: ".8rem", color: COLORS.red, marginBottom: "1rem" }}>{authError}</p>}
          <button type="submit" style={{ ...buttonPrimary, width: "100%" }}>Enter</button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", width: "100%", padding: "1.5rem", background: COLORS.canvas, fontFamily: fontBody }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Jost:wght@400;500;600&display=swap');`}</style>
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gridTemplateColumns: "340px 1fr", gap: "1.5rem" }}>
        {/* Sales list */}
        <div>
          <h2 style={{ fontFamily: fontDisplay, fontSize: "1.1rem", color: COLORS.ink, marginBottom: ".75rem" }}>Sales</h2>
          <p style={{ fontSize: ".75rem", color: COLORS.inkSoft, marginBottom: ".75rem" }}>More than one can be active at a time — each gets its own link.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: ".6rem", marginBottom: "1rem" }}>
            {sales.map((s) => (
              <div key={s.id} onClick={() => setSelectedSaleId(s.id)}
                style={{ borderRadius: 10, padding: ".75rem", cursor: "pointer",
                  background: s.id === selectedSaleId ? COLORS.card : "transparent",
                  border: `1px solid ${s.id === selectedSaleId ? COLORS.ink : COLORS.line}` }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  {renamingSaleId === s.id ? (
                    <div style={{ display: "flex", gap: ".4rem", flex: 1 }} onClick={(e) => e.stopPropagation()}>
                      <input type="text" value={renameValue} onChange={(e) => setRenameValue(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                      <button onClick={() => saveRename(s.id)} style={{ background: "none", border: "none", color: COLORS.green, cursor: "pointer" }}>✓</button>
                      <button onClick={() => setRenamingSaleId(null)} style={{ background: "none", border: "none", color: COLORS.inkSoft, cursor: "pointer" }}>✕</button>
                    </div>
                  ) : (
                    <>
                      <p style={{ fontSize: ".9rem", fontWeight: 500, color: COLORS.ink }}>{s.name}</p>
                      <button onClick={(e) => { e.stopPropagation(); deleteSale(s.id); }} style={{ background: "none", border: "none", color: COLORS.inkSoft, cursor: "pointer" }}>✕</button>
                    </>
                  )}
                </div>
                <p style={{ fontSize: ".75rem", color: s.is_active ? COLORS.green : COLORS.inkSoft, marginTop: ".2rem" }}>{s.is_active ? "● Active" : "Inactive"}</p>
                <div style={{ display: "flex", gap: ".4rem", marginTop: ".5rem", flexWrap: "wrap" }} onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => toggleActive(s)} style={{ ...buttonGhost, color: s.is_active ? COLORS.red : COLORS.green, borderColor: s.is_active ? "#e8a0a0" : COLORS.green }}>
                    {s.is_active ? "Deactivate" : "Activate"}
                  </button>
                  <button onClick={() => { setRenamingSaleId(s.id); setRenameValue(s.name); }} style={buttonGhost}>Rename</button>
                  <button onClick={() => copyLink(s.slug)} style={buttonGhost}>{copiedSlug === s.slug ? "Copied!" : "Copy link"}</button>
                  <button onClick={() => duplicateSale(s)} style={buttonGhost}>Duplicate</button>
                </div>
                <p style={{ fontSize: ".68rem", color: COLORS.inkSoft, marginTop: ".4rem", wordBreak: "break-all" }}>/preorder/{s.slug}</p>
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
              <h2 style={{ fontFamily: fontDisplay, fontSize: "1.1rem", color: COLORS.ink, marginBottom: "1rem" }}>Items in "{selectedSale.name}"</h2>

              {/* Add product form */}
              <div style={{ background: COLORS.card, border: `1.5px solid ${COLORS.green}`, borderRadius: 14, padding: "1.25rem", marginBottom: "1.5rem" }}>
                <span style={smallLabel}>Add a new item</span>
                <div style={{ display: "flex", gap: ".5rem", marginBottom: ".75rem" }}>
                  <input type="text" value={newProduct.name} onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} placeholder="Item name (e.g. Youth Tee)" style={{ ...inputStyle, flex: 1 }} />
                  <input type="number" step="0.01" value={newProduct.price} onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })} placeholder="Base price" style={{ ...inputStyle, width: 110 }} />
                </div>
                <div>
                  <span style={smallLabel}>Photo (optional)</span>
                  <label style={{ display: "block", cursor: "pointer", border: `2px dashed ${COLORS.line}`, borderRadius: 8, padding: ".75rem", textAlign: "center", background: COLORS.canvas }}>
                    <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { if (e.target.files[0]) resizeImage(e.target.files[0], (img) => setNewProduct((p) => ({ ...p, image: img }))); }} />
                    {newProduct.image ? <img src={newProduct.image} alt="" style={{ maxHeight: 120, borderRadius: 6 }} /> : <span style={{ fontSize: ".8rem", color: COLORS.inkSoft }}>Click to upload a photo</span>}
                  </label>
                </div>

                <OptionListEditor title="Sizes" hint="Leave empty to use a generic size list on the form." list={newProduct.sizes} setList={(l) => setNewProduct((p) => ({ ...p, sizes: l }))} draft={newSizeDraft} setDraft={setNewSizeDraft} />
                <OptionListEditor title="Colors" hint="Leave empty to let the customer type in any color." list={newProduct.colors} setList={(l) => setNewProduct((p) => ({ ...p, colors: l }))} draft={newColorDraft} setDraft={setNewColorDraft} />
                <OptionListEditor title="Logos / Designs" hint="Leave empty if this item doesn't need a logo choice." list={newProduct.logos} setList={(l) => setNewProduct((p) => ({ ...p, logos: l }))} draft={newLogoDraft} setDraft={setNewLogoDraft} />

                <div style={{ marginTop: ".85rem", padding: "1rem", background: COLORS.canvas, borderRadius: 10, border: `1px solid ${COLORS.line}` }}>
                  <label style={{ display: "flex", alignItems: "center", gap: ".5rem", fontSize: ".85rem", color: COLORS.ink, cursor: "pointer" }}>
                    <input type="checkbox" checked={newProduct.customTextEnabled} onChange={(e) => setNewProduct((p) => ({ ...p, customTextEnabled: e.target.checked }))} />
                    Allow a custom text field (e.g. a custom name or monogram)
                  </label>
                  {newProduct.customTextEnabled && (
                    <input type="text" value={newProduct.customTextLabel} onChange={(e) => setNewProduct((p) => ({ ...p, customTextLabel: e.target.value }))} placeholder="Field label shown to customer (e.g. Custom Name)" style={{ ...inputStyle, marginTop: ".6rem" }} />
                  )}
                </div>

                <button onClick={createProduct} style={{ ...buttonPrimary, marginTop: "1rem" }}>Add Item</button>
              </div>

              {/* Existing products */}
              <div style={{ display: "flex", flexDirection: "column", gap: ".75rem" }}>
                {products.map((p) => (
                  <div key={p.id} style={{ borderRadius: 12, padding: "1rem", background: COLORS.card, border: `1px solid ${COLORS.line}` }}>
                    {editingProductId === p.id && editProduct ? (
                      <div>
                        <div style={{ display: "flex", gap: ".5rem", marginBottom: ".75rem" }}>
                          <input type="text" value={editProduct.name} onChange={(e) => setEditProduct({ ...editProduct, name: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
                          <input type="number" step="0.01" value={editProduct.price} onChange={(e) => setEditProduct({ ...editProduct, price: e.target.value })} style={{ ...inputStyle, width: 110 }} />
                        </div>
                        <label style={{ display: "block", cursor: "pointer", border: `2px dashed ${COLORS.line}`, borderRadius: 8, padding: ".6rem", textAlign: "center", background: COLORS.canvas, marginBottom: ".5rem" }}>
                          <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { if (e.target.files[0]) resizeImage(e.target.files[0], (img) => setEditProduct((p2) => ({ ...p2, image: img }))); }} />
                          {editProduct.image ? <img src={editProduct.image} alt="" style={{ maxHeight: 100, borderRadius: 6 }} /> : <span style={{ fontSize: ".78rem", color: COLORS.inkSoft }}>Click to upload / replace photo</span>}
                        </label>
                        <OptionListEditor title="Sizes" list={editProduct.sizes} setList={(l) => setEditProduct((p2) => ({ ...p2, sizes: l }))} draft={editSizeDraft} setDraft={setEditSizeDraft} />
                        <OptionListEditor title="Colors" list={editProduct.colors} setList={(l) => setEditProduct((p2) => ({ ...p2, colors: l }))} draft={editColorDraft} setDraft={setEditColorDraft} />
                        <OptionListEditor title="Logos / Designs" list={editProduct.logos} setList={(l) => setEditProduct((p2) => ({ ...p2, logos: l }))} draft={editLogoDraft} setDraft={setEditLogoDraft} />

                        <div style={{ marginTop: ".85rem", padding: "1rem", background: COLORS.canvas, borderRadius: 10, border: `1px solid ${COLORS.line}` }}>
                          <label style={{ display: "flex", alignItems: "center", gap: ".5rem", fontSize: ".85rem", color: COLORS.ink, cursor: "pointer" }}>
                            <input type="checkbox" checked={editProduct.customTextEnabled} onChange={(e) => setEditProduct((p2) => ({ ...p2, customTextEnabled: e.target.checked }))} />
                            Allow a custom text field (e.g. a custom name or monogram)
                          </label>
                          {editProduct.customTextEnabled && (
                            <input type="text" value={editProduct.customTextLabel} onChange={(e) => setEditProduct((p2) => ({ ...p2, customTextLabel: e.target.value }))} placeholder="Field label shown to customer" style={{ ...inputStyle, marginTop: ".6rem" }} />
                          )}
                        </div>
                        <div style={{ display: "flex", gap: ".5rem", marginTop: "1rem" }}>
                          <button onClick={() => saveEdit(p.id)} style={buttonPrimary}>Save</button>
                          <button onClick={() => { setEditingProductId(null); setEditProduct(null); }} style={buttonGhost}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: "flex", gap: "1rem" }}>
                        {p.image_data && <img src={p.image_data} alt="" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 8, flexShrink: 0 }} />}
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                            <div>
                              <p style={{ fontSize: ".92rem", color: COLORS.ink, fontWeight: 500 }}>{p.name}</p>
                              <p style={{ fontSize: ".82rem", color: COLORS.gold }}>${(p.price_cents / 100).toFixed(2)} base</p>
                            </div>
                            <div style={{ display: "flex", gap: ".6rem" }}>
                              <button onClick={() => startEdit(p)} style={{ background: "none", border: "none", color: COLORS.inkSoft, cursor: "pointer" }}>Edit</button>
                              <button onClick={() => deleteProduct(p.id)} style={{ background: "none", border: "none", color: COLORS.inkSoft, cursor: "pointer" }}>Remove</button>
                            </div>
                          </div>
                          <p style={{ fontSize: ".75rem", color: COLORS.inkSoft, marginTop: ".3rem" }}>
                            {(p.sizes || []).length} size{(p.sizes || []).length !== 1 ? "s" : ""} ·{" "}
                            {(p.colors || []).length} color{(p.colors || []).length !== 1 ? "s" : ""} ·{" "}
                            {(p.logos || []).length} logo{(p.logos || []).length !== 1 ? "s" : ""} defined
                          </p>
                          <div style={{ marginTop: ".5rem" }}>
                            <select
                              defaultValue=""
                              onChange={(e) => { moveProduct(p.id, e.target.value); e.target.value = ""; }}
                              style={{ ...inputStyle, width: "auto", fontSize: ".78rem", padding: ".35rem .6rem" }}
                            >
                              <option value="" disabled>Move to another sale…</option>
                              {sales.filter((s) => s.id !== selectedSaleId).map((s) => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {products.length === 0 && <p style={{ fontSize: ".85rem", color: COLORS.inkSoft }}>No items yet — add one above.</p>}
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
