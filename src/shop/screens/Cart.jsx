export default function Cart({ cart, goTo, onCheckout, shippingSettings, fulfillment }) {
  const { cart: items, updateQty, removeItem, subtotalCents } = cart;

  const shippingCents = (() => {
    if (fulfillment === "pickup" || items.length === 0) return 0;
    const freeThresholdCents = Math.round((shippingSettings.freeThreshold || 0) * 100);
    if (freeThresholdCents > 0 && subtotalCents >= freeThresholdCents) return 0;
    const count = items.reduce((n, i) => n + i.qty, 0);
    return Math.round((shippingSettings.base || 0) * 100) + Math.round((shippingSettings.perItem || 0) * 100) * count;
  })();
  const totalCents = subtotalCents + shippingCents;

  return (
    <section className="shop-section">
      <h1>Your cart</h1>
      {items.length === 0 ? (
        <p className="text-muted">
          Your cart is empty. <a href="#" onClick={(e) => { e.preventDefault(); goTo("shop"); }}>Browse the catalog</a>.
        </p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 30, alignItems: "start", marginTop: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {items.map((i) => (
              <div key={i.cartId} style={{ display: "grid", gridTemplateColumns: "96px 1fr auto", gap: 15, alignItems: "center", paddingBottom: 15, borderBottom: "1px solid var(--color-divider)" }}>
                <div className="halftone" style={{ width: 96, aspectRatio: "1/1" }}>{i.image ? <img src={i.image} alt={i.name} /> : i.name}</div>
                <div>
                  <div className="card-title">{i.name}</div>
                  <div className="text-muted" style={{ fontSize: 12 }}>{i.optSummary}</div>
                  <div className="stepper" style={{ marginTop: 6 }}>
                    <button className="qtybtn" onClick={() => updateQty(i.cartId, -1)}>−</button>
                    <span style={{ minWidth: 20, textAlign: "center" }}>{i.qty}</span>
                    <button className="qtybtn" onClick={() => updateQty(i.cartId, 1)}>+</button>
                    <a href="#" onClick={(e) => { e.preventDefault(); removeItem(i.cartId); }} style={{ fontSize: 12, marginLeft: 15 }}>Remove</a>
                  </div>
                </div>
                <div style={{ fontFamily: "var(--font-heading)" }}>${((i.priceCents * i.qty) / 100).toFixed(2)}</div>
              </div>
            ))}
          </div>
          <div className="card elev-sm">
            <div className="card-title">Order summary</div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}><span>Subtotal</span><span>${(subtotalCents / 100).toFixed(2)}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}><span>Estimated shipping</span><span>${(shippingCents / 100).toFixed(2)}</span></div>
            <div className="hr" style={{ margin: "10px 0" }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--font-heading)", fontSize: 17 }}><span>Total</span><span>${(totalCents / 100).toFixed(2)}</span></div>
            <button className="btn btn-primary btn-block" onClick={onCheckout}>Checkout</button>
          </div>
        </div>
      )}
    </section>
  );
}
