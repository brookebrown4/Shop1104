const RESOURCE_LABELS = [
  { key: "threadColors", label: "Thread Colors" },
  { key: "fontOptions", label: "Font Options" },
  { key: "monogramStyles", label: "Monogram Styles" },
  { key: "designs", label: "Designs Available" },
];

// The uploaded PDF is stored as a data: URL. Browsers block top-level
// navigation straight to a data: URL from a target="_blank" link (a
// phishing-prevention restriction), which is why clicking the link did
// nothing. Converting it to a blob: URL at click time isn't restricted the
// same way and reliably opens in the browser's native PDF viewer.
async function previewPdf(dataUrl) {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  window.open(blobUrl, "_blank", "noopener,noreferrer");
  // Revoke well after the new tab has had time to load it.
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
}

export default function CatalogPage({ content }) {
  const resources = (content && content.catalogResources) || {};
  const gallery = (content && content.gallery) || [];

  return (
    <section className="shop-section">
      <h1>Catalog</h1>
      <p className="text-muted">Take a look at some of our recently produced products!</p>

      {gallery.length > 0 && (
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
      )}

      <h2 style={{ marginTop: 30 }}>Reference Catalogs</h2>
      <div className="grid-4" style={{ marginTop: 15 }}>
        {RESOURCE_LABELS.map((r) => {
          const res = resources[r.key];
          return (
            <div key={r.key} className="card">
              <div className="card-title">{r.label}</div>
              {res && res.url ? (
                <button type="button" className="btn btn-secondary" onClick={() => previewPdf(res.url)}>Preview PDF</button>
              ) : (
                <p className="text-muted" style={{ fontSize: 12 }}>Not uploaded yet</p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
