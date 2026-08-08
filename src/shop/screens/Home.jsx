export default function Home({ goTo, products, categories, reviews, onSelectProduct }) {
  // Only products explicitly marked "Featured" in Admin -- falls back to
  // the first 4 in the catalog if nothing's been marked yet, so this
  // section isn't empty before anyone's had a chance to set it up.
  const explicitlyFeatured = (products || []).filter((p) => p.featured);
  const featured = (explicitlyFeatured.length > 0 ? explicitlyFeatured : products || []).slice(0, 4);
  // Same fix as the Shop page's filter list: only show a category tile if
  // a product is actually in it, rather than every admin-configured
  // category (or, with none configured at all, four hardcoded placeholder
  // names that don't correspond to anything real).
  const categoriesWithProducts = (() => {
    const present = new Set((products || []).map((p) => p.category).filter(Boolean));
    return (categories || []).filter((cat) => present.has(cat.name));
  })();

  return (
    <>
      <section className="shop-section">
        <div className="grid-2" style={{ alignItems: "center" }}>
          <div>
            <h6 style={{ color: "var(--color-accent-700)" }}>Local &amp; custom embroidery</h6>
            <h1>Apparel made for you.</h1>
            <p style={{ fontSize: 17, maxWidth: 480, opacity: 0.85 }}>
              Let us bring your next project to life. Whether it's personal, business, or team needs — each project is
              uniquely designed, stitched, and cared for. High quality products stitched to order right here at Shop 1104.
            </p>
            <div style={{ display: "flex", gap: 15, marginTop: 20 }}>
              <button className="btn btn-primary" onClick={() => goTo("shop")}>Shop the catalog</button>
              <button className="btn btn-secondary" onClick={() => goTo("custom")}>Start a custom order</button>
            </div>
          </div>
          <div style={{ width: "100%", aspectRatio: "1/1", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <img src="/Shop_1104_Logo.jpg" alt="Shop 1104" style={{ width: "100%", height: "100%", objectFit: "contain" }} onError={(e) => (e.target.style.display = "none")} />
          </div>
        </div>
      </section>

      {categoriesWithProducts.length > 0 && (
        <section className="shop-section">
          <h2>Shop by category</h2>
          <div className="grid-4" style={{ marginTop: 15 }}>
            {categoriesWithProducts.map((cat) => (
              <a
                key={cat.id || cat.name}
                href="#"
                style={{ textDecoration: "none", color: "inherit", display: "flex", flexDirection: "column", gap: 10 }}
                onClick={(e) => {
                  e.preventDefault();
                  goTo("shop");
                }}
              >
                <div className="halftone" style={{ width: "100%", aspectRatio: "1/1" }}>{cat.name} photo</div>
                <h5 style={{ margin: 0 }}>{cat.name}</h5>
              </a>
            ))}
          </div>
        </section>
      )}

      <section className="shop-section">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <h2>Featured products</h2>
          <a href="#" onClick={(e) => { e.preventDefault(); goTo("shop"); }}>Shop all →</a>
        </div>
        {featured.length === 0 ? (
          <p className="text-muted" style={{ marginTop: 15 }}>No products yet — add some from the Admin panel.</p>
        ) : (
          <div className="grid-4" style={{ marginTop: 15 }}>
            {featured.map((p) => (
              <div key={p.id} className="card" style={{ padding: 0, background: "transparent", gap: 10, cursor: "pointer" }} onClick={() => onSelectProduct(p.id)}>
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

      <section className="shop-section" style={{ paddingBottom: 40 }}>
        <h2>What customers say</h2>
        {reviews.length > 0 ? (
          <div className="grid-3" style={{ marginTop: 15 }}>
            {reviews.map((rv) => (
              <div key={rv.id} className="card" style={{ background: "transparent", padding: 0, gap: 6 }}>
                <div className="card-title">{"★".repeat(rv.rating) + "☆".repeat(5 - rv.rating)}</div>
                <p className="card-body" style={{ fontStyle: "italic" }}>"{rv.quote}"</p>
                <div className="card-meta">— {rv.name}</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted">No reviews yet.</p>
        )}
      </section>
    </>
  );
}
