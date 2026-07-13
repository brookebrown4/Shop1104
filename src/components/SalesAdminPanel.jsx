import React, { useState, useEffect } from "react";
import { Lock, Plus, Trash2, Pencil, Check, X } from "lucide-react";

/**
 * Shop 1104 — Sales & Pricing Admin Panel
 *
 * Drop this into your existing admin area (e.g. as a new tab/section
 * alongside your other admin tools). Gate it the same way you gate the
 * rest of your admin panel; it separately requires the admin code to be
 * entered here too, since it talks directly to backend functions that
 * check ADMIN_ACCESS_CODE server-side.
 *
 * Lets you:
 *  - Create a new "sale" (a pre-order event, e.g. "Fall 2026 Pre-Order")
 *  - Activate exactly one sale at a time (that's the one customers see
 *    on the live intake form)
 *  - Add, edit, and delete priced items ("products") within a sale
 *
 * Nothing here touches code or requires a redeploy — everything is stored
 * in Supabase and read live by the public form.
 */

const COLORS = {
  canvas: "#F7F5F0",
  card: "#FFFFFF",
  ink: "#1D2B3A",
  inkSoft: "#4A5A6A",
  line: "#DDD8CC",
  rust: "#A64B2A",
  gold: "#B8902E",
  green: "#3A7D5C",
};

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
  const [loading, setLoading] = useState(false);
  const [newSaleName, setNewSaleName] = useState("");

  const [newProductName, setNewProductName] = useState("");
  const [newProductPrice, setNewProductPrice] = useState("");
  const [editingProductId, setEditingProductId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");

  const selectedSale = sales.find((s) => s.id === selectedSaleId) || null;

  const loadSales = async (code) => {
    setLoading(true);
    try {
      const res = await fetch("/.netlify/functions/admin-sales", { headers: authHeaders(code) });
      if (!res.ok) throw new Error("Could not load sales.");
      const data = await res.json();
      setSales(data.sales || []);
      if (data.sales && data.sales.length > 0 && !selectedSaleId) {
        setSelectedSaleId(data.sales[0].id);
      }
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async (saleId, code) => {
    if (!saleId) return;
    const res = await fetch(`/.netlify/functions/admin-products?saleId=${saleId}`, {
      headers: authHeaders(code),
    });
    if (res.ok) {
      const data = await res.json();
      setProducts(data.products || []);
    }
  };

  useEffect(() => {
    if (authed && selectedSaleId) loadProducts(selectedSaleId, adminCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed, selectedSaleId]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError("");
    const res = await fetch("/.netlify/functions/admin-sales", { headers: authHeaders(adminCode) });
    if (res.status === 401) {
      setAuthError("Incorrect admin code.");
      return;
    }
    if (!res.ok) {
      setAuthError("Could not connect. Try again.");
      return;
    }
    const data = await res.json();
    setSales(data.sales || []);
    if (data.sales && data.sales.length > 0) setSelectedSaleId(data.sales[0].id);
    setAuthed(true);
  };

  const createSale = async () => {
    if (!newSaleName.trim()) return;
    const res = await fetch("/.netlify/functions/admin-sales", {
      method: "POST",
      headers: authHeaders(adminCode),
      body: JSON.stringify({ action: "create", name: newSaleName.trim() }),
    });
    if (res.ok) {
      setNewSaleName("");
      await loadSales(adminCode);
    }
  };

  const activateSale = async (saleId) => {
    const res = await fetch("/.netlify/functions/admin-sales", {
      method: "POST",
      headers: authHeaders(adminCode),
      body: JSON.stringify({ action: "activate", saleId }),
    });
    if (res.ok) await loadSales(adminCode);
  };

  const deleteSale = async (saleId) => {
    if (!window.confirm("Delete this sale and all its items? This can't be undone.")) return;
    const res = await fetch("/.netlify/functions/admin-sales", {
      method: "POST",
      headers: authHeaders(adminCode),
      body: JSON.stringify({ action: "delete", saleId }),
    });
    if (res.ok) {
      if (selectedSaleId === saleId) setSelectedSaleId(null);
      await loadSales(adminCode);
    }
  };

  const createProduct = async () => {
    if (!newProductName.trim() || !newProductPrice) return;
    const priceCents = Math.round(parseFloat(newProductPrice) * 100);
    if (!Number.isFinite(priceCents) || priceCents <= 0) return;

    const res = await fetch("/.netlify/functions/admin-products", {
      method: "POST",
      headers: authHeaders(adminCode),
      body: JSON.stringify({ action: "create", saleId: selectedSaleId, name: newProductName.trim(), priceCents }),
    });
    if (res.ok) {
      setNewProductName("");
      setNewProductPrice("");
      await loadProducts(selectedSaleId, adminCode);
    }
  };

  const startEdit = (product) => {
    setEditingProductId(product.id);
    setEditName(product.name);
    setEditPrice((product.price_cents / 100).toFixed(2));
  };

  const saveEdit = async (productId) => {
    const priceCents = Math.round(parseFloat(editPrice) * 100);
    const res = await fetch("/.netlify/functions/admin-products", {
      method: "POST",
      headers: authHeaders(adminCode),
      body: JSON.stringify({ action: "update", productId, name: editName.trim(), priceCents }),
    });
    if (res.ok) {
      setEditingProductId(null);
      await loadProducts(selectedSaleId, adminCode);
    }
  };

  const deleteProduct = async (productId) => {
    if (!window.confirm("Delete this item?")) return;
    const res = await fetch("/.netlify/functions/admin-products", {
      method: "POST",
      headers: authHeaders(adminCode),
      body: JSON.stringify({ action: "delete", productId }),
    });
    if (res.ok) await loadProducts(selectedSaleId, adminCode);
  };

  const fieldStyle = { border: `1px solid ${COLORS.line}`, backgroundColor: "#FFFFFF", color: COLORS.ink };

  if (!authed) {
    return (
      <div
        className="min-h-screen w-full flex items-center justify-center p-6"
        style={{ backgroundColor: COLORS.canvas, fontFamily: "'Work Sans', sans-serif" }}
      >
        <form
          onSubmit={handleLogin}
          className="max-w-sm w-full rounded-lg p-6"
          style={{ backgroundColor: COLORS.card, border: `1px solid ${COLORS.line}` }}
        >
          <div className="flex items-center gap-2 mb-4" style={{ color: COLORS.ink }}>
            <Lock size={16} />
            <h1 className="text-lg font-semibold">Sales & Pricing Admin</h1>
          </div>
          <input
            type="password"
            value={adminCode}
            onChange={(e) => setAdminCode(e.target.value)}
            placeholder="Admin code"
            className="w-full rounded-md px-3 py-2 text-sm mb-3 outline-none"
            style={fieldStyle}
          />
          {authError && (
            <p className="text-xs mb-3" style={{ color: COLORS.rust }}>
              {authError}
            </p>
          )}
          <button
            type="submit"
            className="w-full py-2 rounded-md text-sm font-medium"
            style={{ backgroundColor: COLORS.ink, color: "#FFFFFF" }}
          >
            Enter
          </button>
        </form>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen w-full p-6"
      style={{ backgroundColor: COLORS.canvas, fontFamily: "'Work Sans', sans-serif" }}
    >
      <div className="max-w-4xl mx-auto grid grid-cols-3 gap-6">
        {/* Sales list */}
        <div className="col-span-1">
          <h2 className="text-sm font-semibold mb-3" style={{ color: COLORS.ink }}>
            Sales
          </h2>
          <div className="flex flex-col gap-2 mb-4">
            {sales.map((s) => (
              <div
                key={s.id}
                onClick={() => setSelectedSaleId(s.id)}
                className="rounded-md p-3 cursor-pointer flex items-center justify-between"
                style={{
                  backgroundColor: s.id === selectedSaleId ? COLORS.card : "transparent",
                  border: `1px solid ${s.id === selectedSaleId ? COLORS.ink : COLORS.line}`,
                }}
              >
                <div>
                  <p className="text-sm font-medium" style={{ color: COLORS.ink }}>
                    {s.name}
                  </p>
                  <p className="text-xs" style={{ color: s.is_active ? COLORS.green : COLORS.inkSoft }}>
                    {s.is_active ? "● Active" : "Inactive"}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteSale(s.id);
                  }}
                  style={{ color: COLORS.inkSoft }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            {sales.length === 0 && !loading && (
              <p className="text-xs" style={{ color: COLORS.inkSoft }}>
                No sales yet — create one below.
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={newSaleName}
              onChange={(e) => setNewSaleName(e.target.value)}
              placeholder="New sale name"
              className="flex-1 rounded-md px-3 py-2 text-sm outline-none"
              style={fieldStyle}
            />
            <button
              onClick={createSale}
              className="rounded-md px-3 py-2"
              style={{ backgroundColor: COLORS.ink, color: "#FFFFFF" }}
            >
              <Plus size={14} />
            </button>
          </div>
        </div>

        {/* Products for selected sale */}
        <div className="col-span-2">
          {selectedSale ? (
            <>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold" style={{ color: COLORS.ink }}>
                  Items in "{selectedSale.name}"
                </h2>
                {!selectedSale.is_active && (
                  <button
                    onClick={() => activateSale(selectedSale.id)}
                    className="text-xs px-3 py-1.5 rounded-md"
                    style={{ backgroundColor: COLORS.green, color: "#FFFFFF" }}
                  >
                    Set as active sale
                  </button>
                )}
              </div>

              <div className="flex flex-col gap-2 mb-4">
                {products.map((p) => (
                  <div
                    key={p.id}
                    className="rounded-md p-3 flex items-center justify-between"
                    style={{ backgroundColor: COLORS.card, border: `1px solid ${COLORS.line}` }}
                  >
                    {editingProductId === p.id ? (
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="flex-1 rounded-md px-2 py-1 text-sm outline-none"
                          style={fieldStyle}
                        />
                        <input
                          type="number"
                          step="0.01"
                          value={editPrice}
                          onChange={(e) => setEditPrice(e.target.value)}
                          className="w-24 rounded-md px-2 py-1 text-sm outline-none"
                          style={fieldStyle}
                        />
                        <button onClick={() => saveEdit(p.id)} style={{ color: COLORS.green }}>
                          <Check size={16} />
                        </button>
                        <button onClick={() => setEditingProductId(null)} style={{ color: COLORS.inkSoft }}>
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div>
                          <p className="text-sm" style={{ color: COLORS.ink }}>
                            {p.name}
                          </p>
                          <p className="text-xs" style={{ color: COLORS.gold }}>
                            ${(p.price_cents / 100).toFixed(2)}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <button onClick={() => startEdit(p)} style={{ color: COLORS.inkSoft }}>
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => deleteProduct(p.id)} style={{ color: COLORS.inkSoft }}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
                {products.length === 0 && (
                  <p className="text-xs" style={{ color: COLORS.inkSoft }}>
                    No items yet — add one below.
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={newProductName}
                  onChange={(e) => setNewProductName(e.target.value)}
                  placeholder="Item name (e.g. Tee — Indianola Logo)"
                  className="flex-1 rounded-md px-3 py-2 text-sm outline-none"
                  style={fieldStyle}
                />
                <input
                  type="number"
                  step="0.01"
                  value={newProductPrice}
                  onChange={(e) => setNewProductPrice(e.target.value)}
                  placeholder="Price"
                  className="w-24 rounded-md px-3 py-2 text-sm outline-none"
                  style={fieldStyle}
                />
                <button
                  onClick={createProduct}
                  className="rounded-md px-3 py-2"
                  style={{ backgroundColor: COLORS.ink, color: "#FFFFFF" }}
                >
                  <Plus size={14} />
                </button>
              </div>
            </>
          ) : (
            <p className="text-sm" style={{ color: COLORS.inkSoft }}>
              Select or create a sale to manage its items.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
