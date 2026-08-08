export default function ProductDetail({ selectedProduct, options, setOptions, addToCart, onBack, garmentColors, threadColors }) {
  if (!selectedProduct) {
    return (
      <section className="shop-section">
        <a href="#" onClick={(e) => { e.preventDefault(); onBack(); }}>← Back to shop</a>
        <p className="text-muted" style={{ marginTop: 20 }}>Loading…</p>
      </section>
    );
  }

  const p = selectedProduct;
  const set = (key, val) => setOptions((o) => ({ ...o, [key]: val }));
  const toggleAddon = (name) =>
    setOptions((o) => ({ ...o, addons: o.addons.includes(name) ? o.addons.filter((n) => n !== name) : [...o.addons, name] }));

  // Product colors are stored as [{name, extraCost, hex}] once an admin has
  // configured them for this product; fall back to the global color list by
  // name so the swatch always has a hex to render.
  const colorOptions = (p.colors && p.colors.length ? p.colors : garmentColors).map((c) => ({
    name: c.name,
    hex: c.hex || (garmentColors.find((g) => g.name === c.name) || {}).hex || "#ccc",
  }));

  return (
    <section className="shop-section">
      <a href="#" onClick={(e) => { e.preventDefault(); onBack(); }}>← Back to shop</a>
      <div className="grid-2" style={{ marginTop: 20 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="halftone" style={{ width: "100%", aspectRatio: "1/1" }}>{p.image ? <img src={p.image} alt={p.name} /> : `${p.name} photo`}</div>
        </div>
        <div>
          <h6 style={{ color: "var(--color-accent-700)" }}>{p.category}</h6>
          <h1>{p.name}</h1>
          <p style={{ fontSize: 20, fontFamily: "var(--font-heading)" }}>${(p.price_cents / 100).toFixed(2)}</p>
          {p.soldOut && <span className="tag tag-neutral">Sold out</span>}

          {p.sizes && p.sizes.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <h5>Size</h5>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {p.sizes.map((s) => (
                  <button key={s.name} className="pill" data-active={options.size === s.name} onClick={() => set("size", s.name)}>
                    {s.name}{s.extraCost > 0 ? ` (+$${(s.extraCost / 100).toFixed(2)})` : ""}
                  </button>
                ))}
              </div>
            </div>
          )}

          {colorOptions.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <h5>Garment color</h5>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {colorOptions.map((c) => (
                  <button key={c.name} className="swatch" style={{ background: c.hex }} data-active={options.color === c.name} onClick={() => set("color", c.name)} title={c.name} />
                ))}
              </div>
            </div>
          )}

          {p.threads && p.threads.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <h5>Thread color</h5>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {p.threads.map((name) => {
                  const t = threadColors.find((tc) => tc.name === name) || { hex: "#ccc" };
                  return <button key={name} className="swatch" style={{ background: t.hex }} data-active={options.thread === name} onClick={() => set("thread", name)} title={name} />;
                })}
              </div>
            </div>
          )}

          {p.placements && p.placements.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <h5>Embroidery placement</h5>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {p.placements.map((name) => (
                  <button key={name} className="pill" data-active={options.placement === name} onClick={() => set("placement", name)}>{name}</button>
                ))}
              </div>
            </div>
          )}

          {p.designs && p.designs.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <h5>Choose a design</h5>
              <div className="grid-3">
                {p.designs.map((d) => (
                  <div key={d.name} className="designpick" data-active={options.design === d.name} onClick={() => set("design", d.name)}>
                    <div className="halftone" style={{ width: "100%", aspectRatio: "1/1" }}>{d.name}</div>
                    <span style={{ fontSize: 12 }}>{d.name}{d.extraCost > 0 ? ` (+$${(d.extraCost / 100).toFixed(2)})` : ""}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {p.addons && p.addons.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <h5>Add-ons</h5>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {p.addons.map((a) => (
                  <label key={a.name} className="radio">
                    <input type="checkbox" checked={options.addons.includes(a.name)} onChange={() => toggleAddon(a.name)} />
                    <span className="dot" style={{ borderRadius: "var(--radius-sm)" }} />
                    {a.name} (+${(a.extraCost / 100).toFixed(2)})
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="field" style={{ marginTop: 20 }}>
            <label htmlFor="personalize">Personalize (name, initials or short text)</label>
            <input className="input" id="personalize" placeholder="e.g. Ramirez Family" value={options.personalize} onChange={(e) => set("personalize", e.target.value)} />
          </div>

          <div className="field" style={{ marginTop: 20 }}>
            <label htmlFor="customNotes">Additional notes (custom requests, special instructions)</label>
            <textarea className="input" id="customNotes" rows={3} placeholder="Anything else we should know — special placement, reference image, custom wording…" value={options.notes} onChange={(e) => set("notes", e.target.value)} />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 20, marginTop: 20 }}>
            <div className="stepper">
              <button className="qtybtn" onClick={() => set("qty", Math.max(1, options.qty - 1))}>−</button>
              <span style={{ minWidth: 24, textAlign: "center", fontFamily: "var(--font-heading)" }}>{options.qty}</span>
              <button className="qtybtn" onClick={() => set("qty", options.qty + 1)}>+</button>
            </div>
            {p.soldOut ? (
              <button className="btn btn-secondary btn-block" style={{ marginTop: 0, flex: 1 }} disabled>Sold out</button>
            ) : (
              <button
                className="btn btn-primary btn-block"
                style={{ marginTop: 0, flex: 1 }}
                disabled={p.sizes && p.sizes.length > 0 && !options.size}
                onClick={addToCart}
              >
                Add to cart
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
