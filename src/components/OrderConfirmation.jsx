import React from "react";
import { Check } from "lucide-react";

/**
 * Shop 1104 — Order Confirmation Page
 *
 * Route this at /order-confirmation (matching the success_url in
 * create-checkout-session.js). Stripe appends ?session_id=... to the URL,
 * which this page doesn't strictly need to display anything, but you could
 * use it to look up and show order details if you build that lookup later.
 */

const COLORS = {
  canvas: "#EFEAE0",
  card: "#F8F5ED",
  ink: "#1D2B3A",
  inkSoft: "#4A5A6A",
  line: "#D9D2C0",
  rust: "#A64B2A",
};

export default function OrderConfirmation() {
  return (
    <div
      className="min-h-screen w-full flex items-center justify-center p-6"
      style={{ backgroundColor: COLORS.canvas, fontFamily: "'Work Sans', sans-serif" }}
    >
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@600&family=Work+Sans:wght@400;500&display=swap');`}</style>
      <div
        className="max-w-md w-full rounded-lg p-8 text-center"
        style={{ backgroundColor: COLORS.card, border: `1px solid ${COLORS.line}` }}
      >
        <div
          className="mx-auto mb-4 w-12 h-12 rounded-full flex items-center justify-center"
          style={{ backgroundColor: COLORS.ink }}
        >
          <Check size={22} color={COLORS.canvas} />
        </div>
        <h1
          className="text-2xl mb-2"
          style={{ fontFamily: "'Fraunces', serif", color: COLORS.ink, fontWeight: 600 }}
        >
          Payment received
        </h1>
        <p className="text-sm mb-6" style={{ color: COLORS.inkSoft }}>
          Thanks for your pre-order! You'll get a confirmation email shortly, and Shop 1104 will
          reach out with next steps. Sales tax and shipping (if applicable) will be billed
          separately.
        </p>
        <a
          href="/"
          className="inline-block w-full py-2.5 rounded-md text-sm font-medium"
          style={{ backgroundColor: COLORS.rust, color: "#FFFFFF" }}
        >
          Back to Shop 1104
        </a>
      </div>
    </div>
  );
}
