const RESOURCE_LABELS = [
  { key: "threadColors", label: "Thread Colors" },
  { key: "fontOptions", label: "Font Options" },
  { key: "monogramStyles", label: "Monogram Styles" },
  { key: "designs", label: "Designs Available" },
];

export default function CatalogPage({ content }) {
  const resources = (content && content.catalogResources) || {};
  const gallery = (content && content.gallery) || [];

  return (
    <section className="shop-section" style={{ display: "grid", gridTemplateColumns: "220px minmax(0,1fr)", gap: 30 }}>
      {/* Reference links live in a persistent left sidebar rather than
          buried below a (potentially large) photo gallery, so they stay
          easy to find no matter how many gallery photos are added. */}
      <aside>
        <h5>Reference Catalogs</h5>
        <div style={{ display: "flex", flexDirection: "column", gap: 15, marginTop: 10 }}>
          {RESOURCE_LABELS.map((r) => {
            const res = resources[r.key];
            return (
              <div key={r.key}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>{r.label}</div>
                {res && res.url ? (
                  // A real hosted https:// URL now (Supabase Storage or a
                  // pasted link), not an embedded data: URL -- browsers
                  // handle this natively, no special handling needed.
                  <a className="btn btn-secondary" style={{ fontSize: 12, padding: "6px 12px" }} href={res.url} target="_blank" rel="noreferrer">Preview PDF</a>
                ) : (
                  <p className="text-muted" style={{ fontSize: 12 }}>Not uploaded yet</p>
                )}
              </div>
            );
          })}
        </div>
      </aside>

      <div>
        <h1>Catalog</h1>
        <p className="text-muted">Take a look at some of our recently produced products!</p>

        {gallery.length > 0 ? (
          <>
            <h2 style={{ marginTop: 30 }}>Work we've produced</h2>
            <div className="grid-4" style={{ marginTop: 15 }}>
              {gallery.map((g) => (
                <div key={g.id} className="halftone" style={{ width: "100%", aspectRatio: "1/1" }}>
                  {g.image ? <img src={g.image} alt={g.title || "Finished piece"} /> : "Finished piece photo"}
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-muted" style={{ marginTop: 30 }}>No photos added yet — add some from the Admin panel.</p>
        )}
      </div>
    </section>
  );
}
