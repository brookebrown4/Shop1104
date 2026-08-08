import { useState, useEffect, useRef, useCallback } from "react";
import * as api from "../api";

const TABS = ["Products", "Requests", "Portals", "Orders", "Catalog", "Reviews", "Shipping", "Colors"];
const SIZE_LIST = ["XS", "S", "M", "L", "XL", "2XL"];
const IDLE_LOGOUT_MS = 5 * 60 * 1000;

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function Admin({ content, categories, garmentColors, threadColors, placements: placementList }) {
  const [adminCode, setAdminCode] = useState("");
  const [loginError, setLoginError] = useState("");
  const [tab, setTab] = useState("Products");
  const idleTimer = useRef(null);

  const signOut = useCallback(() => {
    clearTimeout(idleTimer.current);
    setAdminCode("");
  }, []);

  const bumpIdleTimer = useCallback(() => {
    if (!adminCode) return;
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(signOut, IDLE_LOGOUT_MS);
  }, [adminCode, signOut]);

  useEffect(() => {
    if (adminCode) bumpIdleTimer();
    return () => clearTimeout(idleTimer.current);
  }, [adminCode, bumpIdleTimer]);

  const handleLogin = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const code = fd.get("password") || "";
    try {
      await api.adminListProducts(code, "");
      setAdminCode(code);
      setLoginError("");
    } catch (err) {
      // Show the real failure instead of always assuming a bad password --
      // a network/server error looks identical to a wrong password
      // otherwise, which makes this impossible to debug from the outside.
      setLoginError(err.message || "Sign-in failed.");
    }
  };

  if (!adminCode) {
    return (
      <section className="shop-section" style={{ maxWidth: 420 }}>
        <h1>Admin sign in</h1>
        <p className="text-muted">Staff only.</p>
        {loginError && <p style={{ color: "var(--color-accent-2-700)" }}>{loginError}</p>}
        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 15, marginTop: 15 }}>
          <div className="field"><label>Password</label><input className="input" name="password" type="password" required /></div>
          <button className="btn btn-primary" type="submit">Sign in</button>
        </form>
      </section>
    );
  }

  return (
    <section className="shop-section" style={{ display: "grid", gridTemplateColumns: "200px minmax(0,1fr)", gap: 30 }} onClick={bumpIdleTimer}>
      <aside style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <h1 style={{ fontSize: 25 }}>Admin</h1>
        {TABS.map((t) => (
          <a key={t} href="#" aria-current={tab === t ? "page" : undefined} onClick={(e) => { e.preventDefault(); setTab(t); }}>{t}</a>
        ))}
        <a href="#" onClick={(e) => { e.preventDefault(); signOut(); }} style={{ marginTop: 20 }}>Sign out</a>
        <span className="text-muted" style={{ fontSize: 11 }}>Auto signs out after 5 min idle</span>
      </aside>
      <div>
        {tab === "Products" && <ProductsTab adminCode={adminCode} categories={categories} garmentColors={garmentColors} threadColors={threadColors} placementList={placementList} />}
        {tab === "Requests" && <RequestsTab adminCode={adminCode} />}
        {tab === "Portals" && <PortalsTab adminCode={adminCode} />}
        {tab === "Orders" && <OrdersTab adminCode={adminCode} />}
        {tab === "Catalog" && <CatalogTab adminCode={adminCode} content={content} />}
        {tab === "Reviews" && <ReviewsTab adminCode={adminCode} content={content} />}
        {tab === "Shipping" && <ShippingTab adminCode={adminCode} content={content} />}
        {tab === "Colors" && <ColorsTab adminCode={adminCode} content={content} categories={categories} />}
      </div>
    </section>
  );
}

// ── Products ─────────────────────────────────────────────────────────────

const emptyProduct = {
  name: "", priceCents: "", category: "", portalCode: "", hidden: false, soldOut: false,
  sizes: {}, colors: {}, threads: [], placements: [], designs: [], addons: [],
};

function ProductsTab({ adminCode, categories, garmentColors, threadColors, placementList }) {
  const [store, setStore] = useState("all");
  const [products, setProducts] = useState([]);
  const [portals, setPortals] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyProduct);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    api.adminListProducts(adminCode, store).then((r) => setProducts(r.products || [])).catch(() => {});
  }, [adminCode, store]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { api.adminListPortals(adminCode).then((r) => setPortals(r.portals || [])).catch(() => {}); }, [adminCode]);

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const toggleMapItem = (group, key, cost) => {
    setForm((f) => {
      const next = { ...f[group] };
      if (next[key] !== undefined) delete next[key];
      else next[key] = cost ?? 0;
      return { ...f, [group]: next };
    });
  };
  const toggleListItem = (group, key) => {
    setForm((f) => ({ ...f, [group]: f[group].includes(key) ? f[group].filter((n) => n !== key) : [...f[group], key] }));
  };

  const startEdit = (p) => {
    const sizesObj = {}; (p.sizes || []).forEach((s) => (sizesObj[s.name] = (s.extraCost || 0) / 100));
    const colorsObj = {}; (p.colors || []).forEach((c) => (colorsObj[c.name] = (c.extraCost || 0) / 100));
    setEditingId(p.id);
    setForm({
      name: p.name, priceCents: (p.price_cents / 100).toString(), category: p.category || "", portalCode: p.portal_code || "",
      hidden: !!p.hidden, soldOut: !!p.sold_out,
      sizes: sizesObj, colors: colorsObj,
      threads: p.threads || [], placements: p.placements || [],
      designs: (p.logos || []).map((d) => ({ name: d.name, extraCost: (d.extraCost || 0) / 100 })),
      addons: (p.addons || []).map((a) => ({ name: a.name, extraCost: (a.extraCost || 0) / 100 })),
    });
  };

  const cancelEdit = () => { setEditingId(null); setForm(emptyProduct); };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.name.trim() || !form.priceCents) {
      setError("Name and price are required.");
      return;
    }
    setSaving(true);
    try {
      const body = {
        action: editingId ? "update" : "create",
        productId: editingId || undefined,
        name: form.name,
        priceCents: Math.round(parseFloat(form.priceCents) * 100),
        category: form.category || null,
        portalCode: form.portalCode || "",
        hidden: form.hidden,
        soldOut: form.soldOut,
        sizes: Object.entries(form.sizes).map(([name, cost]) => ({ name, extraCost: Math.round((cost || 0) * 100) })),
        colors: Object.entries(form.colors).map(([name, cost]) => ({ name, extraCost: Math.round((cost || 0) * 100), hex: (garmentColors.find((c) => c.name === name) || {}).hex })),
        threads: form.threads,
        placements: form.placements,
        logos: form.designs.filter((d) => d.name.trim()).map((d) => ({ name: d.name, extraCost: Math.round((d.extraCost || 0) * 100) })),
        addons: form.addons.filter((a) => a.name.trim()).map((a) => ({ name: a.name, extraCost: Math.round((a.extraCost || 0) * 100) })),
      };
      await api.adminSaveProduct(adminCode, body);
      cancelEdit();
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (p) => {
    if (!window.confirm(`Delete ${p.name}?`)) return;
    await api.adminSaveProduct(adminCode, { action: "delete", productId: p.id });
    load();
  };

  const toggleField = async (p, field, value) => {
    await api.adminSaveProduct(adminCode, { action: "update", productId: p.id, [field]: value });
    load();
  };

  return (
    <div>
      <h2>Products</h2>

      <h3>{editingId ? "Edit product" : "Add a product"}</h3>
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 640, marginBottom: 30 }}>
        {error && <p style={{ color: "var(--color-accent-2-700)" }}>{error}</p>}
        <div className="field">
          <label>Store</label>
          <select className="input" value={form.portalCode} onChange={(e) => set("portalCode", e.target.value)}>
            <option value="">Main Shop (public storefront)</option>
            {portals.map((cp) => <option key={cp.code} value={cp.code}>{cp.name} (client portal)</option>)}
          </select>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 15 }}>
          <div className="field"><label>Product name</label><input className="input" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Snapback Cap" required /></div>
          <div className="field"><label>Price</label><input className="input" type="number" min="0" step="0.01" value={form.priceCents} onChange={(e) => set("priceCents", e.target.value)} placeholder="24.00" required /></div>
        </div>
        <div className="field">
          <label>Category</label>
          <select className="input" value={form.category} onChange={(e) => set("category", e.target.value)}>
            <option value="">No category</option>
            {categories.map((c) => <option key={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div className="field">
          <label>Sizes</label>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
            {SIZE_LIST.map((s) => (
              <div key={s} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <label className="radio" style={{ width: 70 }}>
                  <input type="checkbox" checked={form.sizes[s] !== undefined} onChange={() => toggleMapItem("sizes", s)} />
                  <span className="dot" style={{ borderRadius: "var(--radius-sm)" }} />{s}
                </label>
                {form.sizes[s] !== undefined && (
                  <input className="input" type="number" step="0.01" placeholder="+$0.00" value={form.sizes[s]} onChange={(e) => setForm((f) => ({ ...f, sizes: { ...f.sizes, [s]: e.target.value } }))} style={{ width: 100 }} />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="field">
          <label>Garment colors</label>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
            {garmentColors.map((c) => (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <label className="radio" style={{ width: 130 }}>
                  <input type="checkbox" checked={form.colors[c.name] !== undefined} onChange={() => toggleMapItem("colors", c.name)} />
                  <span className="dot" style={{ borderRadius: "var(--radius-sm)", background: c.hex }} />{c.name}
                </label>
                {form.colors[c.name] !== undefined && (
                  <input className="input" type="number" step="0.01" placeholder="+$0.00" value={form.colors[c.name]} onChange={(e) => setForm((f) => ({ ...f, colors: { ...f.colors, [c.name]: e.target.value } }))} style={{ width: 100 }} />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="field">
          <label>Thread colors</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 6 }}>
            {threadColors.map((t) => (
              <label key={t.id} className="radio"><input type="checkbox" checked={form.threads.includes(t.name)} onChange={() => toggleListItem("threads", t.name)} /><span className="dot" style={{ borderRadius: "var(--radius-sm)", background: t.hex }} />{t.name}</label>
            ))}
          </div>
        </div>

        <div className="field">
          <label>Embroidery placements</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 6 }}>
            {placementList.map((p) => (
              <label key={p.id} className="radio"><input type="checkbox" checked={form.placements.includes(p.name)} onChange={() => toggleListItem("placements", p.name)} /><span className="dot" style={{ borderRadius: "var(--radius-sm)" }} />{p.name}</label>
            ))}
          </div>
        </div>

        <ListEditor label="Designs (choose-a-design picker)" items={form.designs} onChange={(designs) => set("designs", designs)} priceLabel="Extra cost" />
        <ListEditor label="Add-ons" items={form.addons} onChange={(addons) => set("addons", addons)} priceLabel="Price" />

        <div style={{ display: "flex", gap: 20 }}>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 14, cursor: "pointer" }}><input type="checkbox" checked={form.hidden} onChange={(e) => set("hidden", e.target.checked)} />Hide from shop</label>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 14, cursor: "pointer" }}><input type="checkbox" checked={form.soldOut} onChange={(e) => set("soldOut", e.target.checked)} />Sold out / out of stock</label>
        </div>

        <div style={{ display: "flex", gap: 15, alignItems: "center" }}>
          <button className="btn btn-primary" type="submit" disabled={saving}>{editingId ? "Save changes" : "Add product"}</button>
          {editingId && <a href="#" onClick={(e) => { e.preventDefault(); cancelEdit(); }}>Cancel</a>}
        </div>
      </form>

      <div className="field" style={{ maxWidth: 320 }}>
        <label>Show products for</label>
        <select className="input" value={store} onChange={(e) => setStore(e.target.value)}>
          <option value="all">All stores</option>
          <option value="">Main Shop only</option>
          {portals.map((cp) => <option key={cp.code} value={cp.code}>{cp.name} only</option>)}
        </select>
      </div>
      <table className="table">
        <thead><tr><th>Name</th><th>Store</th><th>Category</th><th>Price</th><th>Visibility</th><th>Stock</th><th></th></tr></thead>
        <tbody>
          {products.map((p) => (
            <tr key={p.id}>
              <td>{p.name}</td>
              <td>{p.portal_code ? (portals.find((cp) => cp.code === p.portal_code) || {}).name || p.portal_code : "Main Shop"}</td>
              <td>{p.category || "—"}</td>
              <td>${(p.price_cents / 100).toFixed(2)}</td>
              <td><label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}><input type="checkbox" checked={p.hidden} onChange={(e) => toggleField(p, "hidden", e.target.checked)} />{p.hidden ? "Hidden" : "Visible"}</label></td>
              <td><button type="button" className={`btn ${p.sold_out ? "btn-secondary" : "btn-ghost"}`} style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => toggleField(p, "soldOut", !p.sold_out)}>{p.sold_out ? "Mark in stock" : "Mark sold out"}</button></td>
              <td><a href="#" onClick={(e) => { e.preventDefault(); startEdit(p); }}>Edit</a> <a href="#" onClick={(e) => { e.preventDefault(); remove(p); }} style={{ marginLeft: 8 }}>Delete</a></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ListEditor({ label, items, onChange, priceLabel }) {
  const update = (i, key, val) => onChange(items.map((it, idx) => (idx === i ? { ...it, [key]: val } : it)));
  const remove = (i) => onChange(items.filter((_, idx) => idx !== i));
  const add = () => onChange([...items, { name: "", extraCost: 0 }]);
  return (
    <div className="field">
      <label>{label}</label>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>
        {items.map((it, i) => (
          <div key={i} style={{ display: "flex", gap: 8 }}>
            <input className="input" placeholder="Name" value={it.name} onChange={(e) => update(i, "name", e.target.value)} />
            <input className="input" type="number" step="0.01" placeholder={priceLabel} value={it.extraCost} onChange={(e) => update(i, "extraCost", e.target.value)} style={{ width: 100 }} />
            <button type="button" className="btn btn-ghost" onClick={() => remove(i)}>×</button>
          </div>
        ))}
        <button type="button" className="btn btn-secondary" style={{ alignSelf: "flex-start" }} onClick={add}>Add</button>
      </div>
    </div>
  );
}

// ── Requests ─────────────────────────────────────────────────────────────

function RequestsTab({ adminCode }) {
  const [data, setData] = useState({ customRequests: [], contactMessages: [] });
  useEffect(() => { api.adminListRequests(adminCode).then(setData).catch(() => {}); }, [adminCode]);
  return (
    <div>
      <h2>Custom order requests</h2>
      {data.customRequests.length === 0 ? <p className="text-muted">No custom order requests yet.</p> : (
        <table className="table">
          <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Garment</th><th>Qty</th><th>Need by</th></tr></thead>
          <tbody>{data.customRequests.map((r) => <tr key={r.id}><td>{r.fullName}</td><td>{r.email}</td><td>{r.phone}</td><td>{r.garmentType}</td><td>{r.quantity}</td><td>{r.needBy}</td></tr>)}</tbody>
        </table>
      )}
      <h2 style={{ marginTop: 30 }}>Contact messages</h2>
      {data.contactMessages.length === 0 ? <p className="text-muted">No contact messages yet.</p> : (
        <table className="table">
          <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Order #</th><th>Message</th></tr></thead>
          <tbody>{data.contactMessages.map((m) => <tr key={m.id}><td>{m.fullName}</td><td>{m.email}</td><td>{m.phone}</td><td>{m.orderNumber}</td><td>{m.message}</td></tr>)}</tbody>
        </table>
      )}
    </div>
  );
}

// ── Portals ──────────────────────────────────────────────────────────────

function PortalsTab({ adminCode }) {
  const [portals, setPortals] = useState([]);
  const [passwordEnabled, setPasswordEnabled] = useState(false);
  const load = useCallback(() => { api.adminListPortals(adminCode).then((r) => setPortals(r.portals || [])).catch(() => {}); }, [adminCode]);
  useEffect(() => { load(); }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    await api.adminPortals(adminCode, {
      action: "createPortal",
      name: fd.get("name"),
      code: fd.get("code"),
      passwordEnabled,
      password: fd.get("password") || "",
    });
    e.target.reset();
    setPasswordEnabled(false);
    load();
  };

  return (
    <div>
      <h2>Client portals</h2>
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 15, maxWidth: 420, marginBottom: 20 }}>
        <div className="field"><label>Business / team name</label><input className="input" name="name" placeholder="e.g. Acme Construction" required /></div>
        <div className="field"><label>Access code</label><input className="input" name="code" placeholder="e.g. ACME" required /></div>
        <label className="radio"><input type="checkbox" checked={passwordEnabled} onChange={(e) => setPasswordEnabled(e.target.checked)} /><span className="dot" style={{ borderRadius: "var(--radius-sm)" }} />Require a password for this store</label>
        {passwordEnabled && <div className="field"><label>Password</label><input className="input" name="password" type="password" required /></div>}
        <button className="btn btn-primary" type="submit" style={{ alignSelf: "flex-start" }}>Create client portal</button>
      </form>
      <table className="table">
        <thead><tr><th>Name</th><th>Access code</th><th>Password protected</th></tr></thead>
        <tbody>{portals.map((cp) => <tr key={cp.code}><td>{cp.name}</td><td>{cp.code}</td><td>{cp.passwordEnabled ? "Yes" : "No"}</td></tr>)}</tbody>
      </table>
      <p className="text-muted" style={{ marginTop: 15 }}>Add and manage each portal's products from the Products tab — pick the store there when adding a product.</p>
    </div>
  );
}

// ── Orders ───────────────────────────────────────────────────────────────

const STATUS_TAG = { Paid: "tag-accent", paid: "tag-accent", Pending: "tag-accent-2", pending: "tag-accent-2", Invoiced: "tag-neutral", Refunded: "tag-outline" };

function OrdersTab({ adminCode }) {
  const [orders, setOrders] = useState([]);
  const load = useCallback(() => { api.adminListOrders(adminCode).then((r) => setOrders(r.orders || [])).catch(() => {}); }, [adminCode]);
  useEffect(() => { load(); }, [load]);

  const setStatus = async (o, status) => { await api.adminOrders(adminCode, { action: "update", orderId: o.id, fields: { status } }); load(); };
  const remove = async (o) => { if (!window.confirm(`Delete order ${o.shortId}?`)) return; await api.adminOrders(adminCode, { action: "delete", orderId: o.id }); load(); };

  return (
    <div>
      <h2>Orders &amp; invoices</h2>
      <table className="table">
        <thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Total</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id}>
              <td>{o.shortId}</td>
              <td>{o.customer}</td>
              <td>{o.items}</td>
              <td>${o.total}</td>
              <td>
                <select className="input" style={{ minHeight: 28, fontSize: 12, padding: "2px 6px" }} value={o.status} onChange={(e) => setStatus(o, e.target.value)}>
                  {["pending", "paid", "Invoiced", "Refunded"].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </td>
              <td><a href="#" onClick={(e) => { e.preventDefault(); remove(o); }}>Delete</a></td>
            </tr>
          ))}
        </tbody>
      </table>
      {orders.length === 0 && <p className="text-muted">No orders yet.</p>}
    </div>
  );
}

// ── Catalog (reference PDFs) ─────────────────────────────────────────────

const RESOURCE_LABELS = [
  { key: "threadColors", label: "Thread Colors" },
  { key: "fontOptions", label: "Font Options" },
  { key: "monogramStyles", label: "Monogram Styles" },
  { key: "designs", label: "Designs Available" },
];

function CatalogTab({ adminCode, content }) {
  const [resources, setResources] = useState((content && content.catalogResources) || {});
  const [busy, setBusy] = useState("");

  const upload = async (key, file) => {
    if (!file) return;
    setBusy(key);
    try {
      const url = await fileToDataUrl(file);
      const next = { ...resources, [key]: { url, fileName: file.name } };
      await api.adminSiteContent(adminCode, { resource: "catalogResources", action: "update", value: next });
      setResources(next);
    } finally {
      setBusy("");
    }
  };

  return (
    <div>
      <h2>Catalog reference PDFs</h2>
      <p className="text-muted">Upload or replace the PDF customers see on the Catalog page. Swap the file any time.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 15, maxWidth: 480, marginTop: 15 }}>
        {RESOURCE_LABELS.map((r) => (
          <div className="field" key={r.key}>
            <label>{r.label}</label>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input className="input" type="file" accept="application/pdf" onChange={(e) => upload(r.key, e.target.files[0])} disabled={busy === r.key} />
              {resources[r.key] && resources[r.key].url && <span className="tag tag-accent">{resources[r.key].fileName}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Reviews ──────────────────────────────────────────────────────────────

function ReviewsTab({ adminCode, content }) {
  const [reviews, setReviews] = useState((content && content.reviews) || []);

  const load = () => api.getSiteContent().then((r) => setReviews(r.reviews || [])).catch(() => {});

  const submit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    await api.adminSiteContent(adminCode, { resource: "reviews", action: "create", fields: { name: fd.get("name"), rating: fd.get("rating"), quote: fd.get("quote") } });
    e.target.reset();
    load();
  };
  const remove = async (id) => { await api.adminSiteContent(adminCode, { resource: "reviews", action: "delete", id }); load(); };

  return (
    <div>
      <h2>Reviews</h2>
      <p className="text-muted">Add reviews to show on the homepage.</p>
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 15, maxWidth: 420, marginBottom: 20 }}>
        <div className="field"><label>Customer name</label><input className="input" name="name" placeholder="e.g. Priya S." required /></div>
        <div className="field">
          <label>Rating</label>
          <select className="input" name="rating" required>
            {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{"★".repeat(n) + "☆".repeat(5 - n)}</option>)}
          </select>
        </div>
        <div className="field"><label>Review text</label><textarea className="input" name="quote" placeholder="What did they say?" required /></div>
        <button className="btn btn-primary" type="submit" style={{ alignSelf: "flex-start" }}>Add review</button>
      </form>
      <table className="table">
        <thead><tr><th>Name</th><th>Rating</th><th>Review</th><th></th></tr></thead>
        <tbody>{reviews.map((rv) => <tr key={rv.id}><td>{rv.name}</td><td>{"★".repeat(rv.rating)}</td><td>{rv.quote}</td><td><a href="#" onClick={(e) => { e.preventDefault(); remove(rv.id); }}>Remove</a></td></tr>)}</tbody>
      </table>
    </div>
  );
}

// ── Shipping ─────────────────────────────────────────────────────────────

function ShippingTab({ adminCode, content }) {
  const initial = (content && content.shippingSettings) || { base: 0, perItem: 0, freeThreshold: 0 };
  const [ship, setShip] = useState(initial);
  const [saved, setSaved] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    await api.adminSiteContent(adminCode, { resource: "shippingSettings", action: "update", value: ship });
    setSaved(true);
  };

  const example = ship.freeThreshold > 0 ? "0.00" : ((ship.base || 0) + (ship.perItem || 0) * 3).toFixed(2);

  return (
    <div>
      <h2>Shipping calculator</h2>
      <p className="text-muted">Set the formula used to price shipping at checkout: a base rate plus a per-item rate, with an optional free-shipping threshold.</p>
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 15, maxWidth: 360, marginTop: 15 }}>
        <div className="field"><label>Base rate ($)</label><input className="input" type="number" min="0" step="0.01" value={ship.base} onChange={(e) => { setShip({ ...ship, base: parseFloat(e.target.value) || 0 }); setSaved(false); }} /></div>
        <div className="field"><label>Per item ($)</label><input className="input" type="number" min="0" step="0.01" value={ship.perItem} onChange={(e) => { setShip({ ...ship, perItem: parseFloat(e.target.value) || 0 }); setSaved(false); }} /></div>
        <div className="field"><label>Free shipping over ($, 0 = disabled)</label><input className="input" type="number" min="0" step="0.01" value={ship.freeThreshold} onChange={(e) => { setShip({ ...ship, freeThreshold: parseFloat(e.target.value) || 0 }); setSaved(false); }} /></div>
        <button className="btn btn-primary" type="submit" style={{ alignSelf: "flex-start" }}>Save</button>
        {saved && <span className="tag tag-accent" style={{ alignSelf: "flex-start" }}>Saved</span>}
      </form>
      <p className="text-muted" style={{ marginTop: 15, fontSize: 12 }}>Example: 3 items in cart → ${example} shipping (local pickup is always free).</p>
    </div>
  );
}

// ── Colors & Placement ───────────────────────────────────────────────────

function ColorsTab({ adminCode, content, categories }) {
  const [colors, setColors] = useState((content && content.garmentColors) || []);
  const [threads, setThreads] = useState((content && content.threads) || []);
  const [placementItems, setPlacementItems] = useState((content && content.placements) || []);
  const [cats, setCats] = useState(categories || []);

  const reload = () => api.getSiteContent().then((r) => { setColors(r.garmentColors || []); setThreads(r.threads || []); setPlacementItems(r.placements || []); setCats(r.categories || []); }).catch(() => {});

  const addColor = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    await api.adminSiteContent(adminCode, { resource: "colors", action: "create", fields: { name: fd.get("name"), hex: fd.get("hex") } });
    e.target.reset();
    reload();
  };
  const removeColor = async (id) => { await api.adminSiteContent(adminCode, { resource: "colors", action: "delete", id }); reload(); };

  const addThread = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    await api.adminSiteContent(adminCode, { resource: "threads", action: "create", fields: { name: fd.get("name"), hex: fd.get("hex") } });
    e.target.reset();
    reload();
  };
  const removeThread = async (id) => { await api.adminSiteContent(adminCode, { resource: "threads", action: "delete", id }); reload(); };

  const addPlacement = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    await api.adminSiteContent(adminCode, { resource: "placements", action: "create", fields: { name: fd.get("name") } });
    e.target.reset();
    reload();
  };
  const removePlacement = async (id) => { await api.adminSiteContent(adminCode, { resource: "placements", action: "delete", id }); reload(); };

  const addCategory = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    await api.adminSiteContent(adminCode, { resource: "categories", action: "create", fields: { name: fd.get("name") } });
    e.target.reset();
    reload();
  };
  const toggleCategoryColor = async (cat, colorName) => {
    const allowed = cat.allowedColors.includes(colorName) ? cat.allowedColors.filter((n) => n !== colorName) : [...cat.allowedColors, colorName];
    await api.adminSiteContent(adminCode, { resource: "categories", action: "update", id: cat.id, fields: { name: cat.name, allowedColors: allowed } });
    reload();
  };

  return (
    <div>
      <h2>Colors &amp; Placement</h2>
      <p className="text-muted">These options appear on every product's Garment color and Thread color pickers.</p>

      <h3 style={{ marginTop: 20 }}>Categories</h3>
      <form onSubmit={addCategory} style={{ display: "flex", gap: 8, maxWidth: 420 }}>
        <input className="input" name="name" placeholder="New category name" required />
        <button className="btn btn-secondary" type="submit">Add</button>
      </form>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
        {cats.map((c) => <span key={c.id} className="tag tag-neutral">{c.name}</span>)}
      </div>

      <h3 style={{ marginTop: 30 }}>Garment colors</h3>
      <form onSubmit={addColor} style={{ display: "flex", gap: 8, alignItems: "center", maxWidth: 420 }}>
        <input className="input" name="name" placeholder="Color name" required />
        <input type="color" name="hex" defaultValue="#000000" style={{ width: 44, height: 36, border: "1px solid var(--color-divider)", borderRadius: "var(--radius-md)", padding: 2 }} />
        <button className="btn btn-secondary" type="submit">Add</button>
      </form>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 15 }}>
        {colors.map((c) => (
          <span key={c.id} className="tag tag-neutral" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 14, height: 14, borderRadius: "50%", background: c.hex, display: "inline-block", boxShadow: "inset 0 0 0 1px var(--color-divider)" }} />
            {c.name} <a href="#" onClick={(e) => { e.preventDefault(); removeColor(c.id); }} style={{ marginLeft: 2 }}>×</a>
          </span>
        ))}
      </div>

      <h3 style={{ marginTop: 30 }}>Colors per category</h3>
      <p className="text-muted">Restrict which garment colors show for each category. Leave a category with none checked to allow all colors.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 20, marginTop: 15 }}>
        {cats.map((cat) => (
          <div key={cat.id}>
            <h5 style={{ marginBottom: 6 }}>{cat.name}</h5>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              {colors.map((c) => (
                <label key={c.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
                  <input type="checkbox" checked={cat.allowedColors.includes(c.name)} onChange={() => toggleCategoryColor(cat, c.name)} />
                  <span style={{ width: 12, height: 12, borderRadius: "50%", background: c.hex, display: "inline-block", boxShadow: "inset 0 0 0 1px var(--color-divider)" }} />
                  {c.name}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      <h3 style={{ marginTop: 30 }}>Thread colors</h3>
      <form onSubmit={addThread} style={{ display: "flex", gap: 8, alignItems: "center", maxWidth: 420 }}>
        <input className="input" name="name" placeholder="Thread color name" required />
        <input type="color" name="hex" defaultValue="#000000" style={{ width: 44, height: 36, border: "1px solid var(--color-divider)", borderRadius: "var(--radius-md)", padding: 2 }} />
        <button className="btn btn-secondary" type="submit">Add</button>
      </form>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 15 }}>
        {threads.map((t) => (
          <span key={t.id} className="tag tag-neutral" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 14, height: 14, borderRadius: "50%", background: t.hex, display: "inline-block", boxShadow: "inset 0 0 0 1px var(--color-divider)" }} />
            {t.name} <a href="#" onClick={(e) => { e.preventDefault(); removeThread(t.id); }} style={{ marginLeft: 2 }}>×</a>
          </span>
        ))}
      </div>

      <h3 style={{ marginTop: 30 }}>Embroidery placements</h3>
      <form onSubmit={addPlacement} style={{ display: "flex", gap: 8, maxWidth: 420 }}>
        <input className="input" name="name" placeholder="e.g. Right Sleeve" required />
        <button className="btn btn-secondary" type="submit">Add</button>
      </form>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 15 }}>
        {placementItems.map((p) => <span key={p.id} className="tag tag-neutral">{p.name} <a href="#" onClick={(e) => { e.preventDefault(); removePlacement(p.id); }} style={{ marginLeft: 4 }}>×</a></span>)}
      </div>
    </div>
  );
}
