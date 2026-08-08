import { useState, useMemo } from "react";

const SIZE_FILTERS = ["XS", "S", "M", "L", "XL", "2XL"];

export default function Shop({ products, productsError, categories, onSelectProduct }) {
  const [activeCategories, setActiveCategories] = useState([]);

  // Only offer a category as a filter if a product actually has it --
  // otherwise checking it just leads to an empty result every time, and an
  // admin-configured category with nothing in it yet shouldn't show at all.
  const categoriesWithProducts = useMemo(() => {
    const present = new Set((products || []).map((p) => p.category).filter(Boolean));
    return categories.filter((cat) => present.has(cat.name));
  }, [products, categories]);

  const filtered = useMemo(() => {
    if (activeCategories.length === 0) return products || [];
    return (products || []).filter((p) => activeCategories.includes(p.category));
  }, [products, activeCategories]);

  const toggleCategory = (name) => {
    setActiveCategories((c) => (c.includes(name) ? c.filter((n) => n !== name) : [...c, name]));
  };

  return (
    <section className="shop-section" style={{ display: "grid", gridTemplateColumns: "220px minmax(0,1fr)", gap: 30 }}>
      <aside>
        {categoriesWithProducts.length > 0 && (
          <>
            <h5>Garment</h5>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
              {categoriesWithProducts.map((cat) => (
                <label key={cat.id} className="radio">
                  <input type="checkbox" checked={activeCategories.includes(cat.name)} onChange={() => toggleCategory(cat.name)} />
                  <span className="dot" style={{ borderRadius: "var(--radius-sm)" }} />
                  {cat.name}
                </label>
              ))}
            </div>
          </>
        )}
        <h5>Size</h5>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {SIZE_FILTERS.map((sz) => (
            <span key={sz} className="tag tag-neutral">{sz}</span>
          ))}
        </div>
      </aside>
      <div>
        <h2>All products</h2>
        <p className="text-muted">
          {productsError ? productsError : `${filtered.length} items — every piece can be personalized with your text, thread color and design.`}
        </p>
        <div className="grid-3" style={{ marginTop: 15 }}>
          {filtered.map((p) => (
            <div key={p.id} className="card" style={{ padding: 0, background: "transparent", gap: 10, cursor: "pointer" }} onClick={() => onSelectProduct(p.id)}>
              <div className="halftone" style={{ width: "100%", aspectRatio: "1/1" }}>{p.image ? <img src={p.image} alt={p.name} /> : `${p.name} photo`}</div>
              <div className="card-kicker">{p.category}</div>
              <div className="card-title">{p.name}</div>
              <div className="card-meta">
                <span className="tag tag-accent">Customizable</span>
                {p.soldOut && <span className="tag tag-neutral">Sold out</span>}
                <span>${(p.price_cents / 100).toFixed(2)}</span>
              </div>
            </div>
          ))}
        </div>
        {filtered.length === 0 && !productsError && <p className="text-muted">No products match those filters yet.</p>}
      </div>
    </section>
  );
}
