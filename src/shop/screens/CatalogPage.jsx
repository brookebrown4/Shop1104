import { useState } from "react";

const RESOURCE_LABELS = [
  { key: "threadColors", label: "Thread Colors" },
  { key: "fontOptions", label: "Font Options" },
  { key: "monogramStyles", label: "Monogram Styles" },
  { key: "designs", label: "Designs Available" },
];

export default function CatalogPage({ content }) {
  const resources = (content && content.catalogResources) || {};
  const gallery = (content && content.gallery) || [];
  const [preview, setPreview] = useState(null); // { label, blobUrl } | { label, loading: true }

  // Chrome's built-in PDF viewer doesn't reliably render a data: URI given
  // straight to an <iframe> src (confirmed -- shows a black box instead of
  // the PDF). Converting it to a blob: URL first renders correctly.
  const openPreview = async (label, dataUrl) => {
    setPreview({ label, loading: true });
    try {
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      setPreview({ label, blobUrl });
    } catch {
      setPreview({ label, error: true });
    }
  };

  const closePreview = () => {
    if (preview && preview.blobUrl) URL.revokeObjectURL(preview.blobUrl);
    setPreview(null);
  };

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
                <button type="button" className="btn btn-secondary" onClick={() => openPreview(r.label, res.url)}>Preview PDF</button>
              ) : (
                <p className="text-muted" style={{ fontSize: 12 }}>Not uploaded yet</p>
              )}
            </div>
          );
        })}
      </div>

      {preview && (
        // Rendered inline (an <iframe> on this same page) rather than opened
        // as a new tab/window -- browser popup blockers can silently block
        // window.open() even from a direct click, and there's no
        // popup-blocker equivalent for an iframe already in the page.
        <div className="dialog-backdrop" onClick={closePreview}>
          <div className="dialog" style={{ maxWidth: 900, width: "92vw", height: "88vh" }} onClick={(e) => e.stopPropagation()}>
            <div className="dialog-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>{preview.label}</span>
              <button type="button" className="btn btn-secondary" onClick={closePreview}>Close</button>
            </div>
            {preview.loading && <p className="text-muted">Loading…</p>}
            {preview.error && <p style={{ color: "var(--color-accent-2-700)" }}>Could not load this PDF.</p>}
            {preview.blobUrl && (
              <iframe title={preview.label} src={preview.blobUrl} style={{ flex: 1, width: "100%", border: "none", borderRadius: "var(--radius-md)" }} />
            )}
          </div>
        </div>
      )}
    </section>
  );
}
