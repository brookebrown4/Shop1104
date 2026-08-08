import { useState, useEffect } from "react";
import * as api from "../api";

export default function Confirmation({ confirmSessionId, onContinue }) {
  const [state, setState] = useState({ loading: true, paid: false, orderNumber: "", error: "" });

  useEffect(() => {
    if (!confirmSessionId) {
      setState({ loading: false, paid: false, orderNumber: "", error: "No checkout session found." });
      return;
    }
    api
      .getOrderConfirmation(confirmSessionId)
      .then((r) => setState({ loading: false, paid: r.paid, orderNumber: r.orderNumber || "", error: r.paid ? "" : "" }))
      .catch((e) => setState({ loading: false, paid: false, orderNumber: "", error: e.message }));
  }, [confirmSessionId]);

  if (state.loading) {
    return (
      <section className="shop-section" style={{ maxWidth: 520 }}>
        <p className="text-muted">Confirming your order…</p>
      </section>
    );
  }

  if (!state.paid) {
    return (
      <section className="shop-section" style={{ maxWidth: 520 }}>
        <h6 style={{ color: "var(--color-accent-2-700)" }}>Checkout not completed</h6>
        <h1>We couldn't confirm this order.</h1>
        <p>{state.error || "This checkout session hasn't completed payment yet. If you already paid, refresh this page."}</p>
        <button className="btn btn-primary" onClick={onContinue}>Back to shop</button>
      </section>
    );
  }

  return (
    <section className="shop-section" style={{ textAlign: "left", maxWidth: 520 }}>
      <h6 style={{ color: "var(--color-accent-700)" }}>Order confirmed</h6>
      <h1>Thanks — we're stitching it up.</h1>
      <p>
        Order <strong>{state.orderNumber}</strong> is in. You'll get a text when it's ready, whether that's shipping out or
        waiting at the counter at Shop 1104.
      </p>
      <button className="btn btn-primary" onClick={onContinue}>Continue shopping</button>
    </section>
  );
}
