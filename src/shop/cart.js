import { useState, useEffect, useCallback } from "react";

const CART_KEY = "shop1104_cart_v1";

function loadCart() {
  try {
    const raw = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

export function useCart() {
  const [cart, setCart] = useState(loadCart);

  useEffect(() => {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
    } catch {
      // storage unavailable (private browsing etc.) -- cart just won't persist
    }
  }, [cart]);

  const addItem = useCallback((item) => {
    setCart((c) => [...c, { ...item, cartId: "c" + Date.now() + Math.floor(Math.random() * 1000) }]);
  }, []);

  const updateQty = useCallback((cartId, delta) => {
    setCart((c) => c.map((i) => (i.cartId === cartId ? { ...i, qty: Math.max(1, i.qty + delta) } : i)));
  }, []);

  const removeItem = useCallback((cartId) => {
    setCart((c) => c.filter((i) => i.cartId !== cartId));
  }, []);

  const clear = useCallback(() => setCart([]), []);

  const count = cart.reduce((n, i) => n + i.qty, 0);
  const subtotalCents = cart.reduce((n, i) => n + i.priceCents * i.qty, 0);

  return { cart, addItem, updateQty, removeItem, clear, count, subtotalCents };
}
