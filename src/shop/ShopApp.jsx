import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import "./design-system.css";
import { useCart } from "./cart";
import * as api from "./api";

import Home from "./screens/Home";
import Shop from "./screens/Shop";
import ProductDetail from "./screens/ProductDetail";
import Cart from "./screens/Cart";
import Checkout from "./screens/Checkout";
import Confirmation from "./screens/Confirmation";
import CustomOrder from "./screens/CustomOrder";
import CatalogPage from "./screens/CatalogPage";
import Contact from "./screens/Contact";
import ClientPortal from "./screens/ClientPortal";
import Admin from "./screens/Admin";

const NAV_LINKS = [
  { screen: "home", label: "Home" },
  { screen: "shop", label: "Shop" },
  { screen: "catalog", label: "Catalog" },
  { screen: "custom", label: "Custom Orders" },
  { screen: "portal", label: "Client Portal" },
  { screen: "contact", label: "Contact" },
];

// Screens that live at a real top-level URL via the parent App's router.
// Sub-flows (product/cart/checkout/confirm) are in-app state only, matching
// the design mockup (which never models per-screen URLs either).
const URL_SCREEN = { home: "home", shop: "shop", catalog: "catalog", custom: "custom", contact: "contact", portal: "clients", admin: "admin" };

const emptyOptions = { size: "", color: "", thread: "", placement: "", design: "", personalize: "", notes: "", addons: [], qty: 1 };

export default function ShopApp({ page, nav, initialContent }) {
  const [screen, setScreen] = useState(page === "clients" ? "portal" : page || "home");
  const [content, setContent] = useState(initialContent || null);
  const [products, setProducts] = useState(null);
  const [productsError, setProductsError] = useState("");
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [options, setOptions] = useState(emptyOptions);
  const [fulfillment, setFulfillment] = useState("ship");
  const [portal, setPortal] = useState({ loggedIn: false, code: "", name: "", error: "" });
  const [confirmSessionId, setConfirmSessionId] = useState(null);
  const cartState = useCart();
  // Remembers which screen a product was opened from (shop vs. portal), so
  // "Back to shop" on the product page returns a logged-in portal user to
  // their portal instead of bouncing them out to the public catalog.
  const productOrigin = useRef("shop");

  const goTo = useCallback(
    (nextScreen, opts) => {
      if (nextScreen === "product") productOrigin.current = screen === "portal" ? "portal" : "shop";
      setScreen(nextScreen);
      if (URL_SCREEN[nextScreen]) nav(URL_SCREEN[nextScreen]);
      if (opts && opts.productId !== undefined) {
        setSelectedProductId(opts.productId);
        setOptions({ ...emptyOptions });
      }
      window.scrollTo(0, 0);
    },
    [nav, screen]
  );

  // App.jsx already fetches get-site-content once (it gates all rendering
  // on that call) and hands us the result via initialContent -- only fetch
  // it ourselves if that somehow didn't happen, so this endpoint isn't hit
  // twice on every page load.
  useEffect(() => {
    if (initialContent) return;
    api.getSiteContent().then(setContent).catch(() => setContent({}));
  }, [initialContent]);

  // Load the main-shop catalog once; portal products are loaded separately
  // by ClientPortal after a successful login.
  useEffect(() => {
    api
      .getProducts()
      .then((r) => setProducts(r.products))
      .catch((e) => setProductsError(e.message));
  }, []);

  // Load full product detail when a product is selected.
  useEffect(() => {
    if (!selectedProductId) {
      setSelectedProduct(null);
      return;
    }
    let cancelled = false;
    api
      .getProduct(selectedProductId)
      .then((r) => {
        if (!cancelled) setSelectedProduct(r.product);
      })
      .catch(() => {
        if (!cancelled) setSelectedProduct(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedProductId]);

  // Stripe redirects back here with ?session_id=...; pull it once on mount
  // if we land directly on the confirm screen via URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sid = params.get("session_id");
    if (sid) {
      setConfirmSessionId(sid);
      setScreen("confirm");
    }
  }, []);

  const categories = (content && content.categories) || [];
  const garmentColors = (content && content.garmentColors) || [];
  const threadColors = (content && content.threads) || [];
  const placements = (content && content.placements) || [];
  const reviews = (content && content.reviews) || [];
  const shippingSettings = (content && content.shippingSettings) || { base: 0, perItem: 0, freeThreshold: 0 };

  const addToCart = () => {
    if (!selectedProduct) return;
    const summaryParts = [];
    if (options.size) summaryParts.push(options.size);
    if (options.color) summaryParts.push(options.color + " garment");
    if (options.thread) summaryParts.push(options.thread + " thread");
    if (options.placement) summaryParts.push(options.placement);
    if (options.design) summaryParts.push(options.design);
    if (options.addons.length) summaryParts.push(options.addons.join(", "));
    if (options.personalize) summaryParts.push(`"${options.personalize}"`);
    if (options.notes) summaryParts.push("Note: " + options.notes);

    const addonCents = (selectedProduct.addons || [])
      .filter((a) => options.addons.includes(a.name))
      .reduce((s, a) => s + (a.extraCost || 0), 0);
    const sizeCents = (selectedProduct.sizes || []).find((s) => s.name === options.size)?.extraCost || 0;
    const colorCents = (selectedProduct.colors || []).find((c) => c.name === options.color)?.extraCost || 0;
    const designCents = (selectedProduct.designs || []).find((d) => d.name === options.design)?.extraCost || 0;

    cartState.addItem({
      productId: selectedProduct.id,
      name: selectedProduct.name,
      image: selectedProduct.image,
      priceCents: selectedProduct.price_cents + sizeCents + colorCents + designCents + addonCents,
      qty: options.qty,
      size: options.size || null,
      color: options.color || null,
      thread: options.thread || null,
      placement: options.placement || null,
      design: options.design || null,
      addons: options.addons,
      personalize: options.personalize,
      notes: options.notes,
      optSummary: summaryParts.join(" · "),
    });
    goTo("cart");
  };

  const activeCatalog = portal.loggedIn ? portal.products || [] : products || [];

  const screenProps = {
    goTo,
    content,
    categories,
    garmentColors,
    threadColors,
    placements,
    reviews,
    products: activeCatalog,
    productsError,
    selectedProduct,
    options,
    setOptions,
    addToCart,
    cart: cartState,
    fulfillment,
    setFulfillment,
    shippingSettings,
    portal,
    setPortal,
    confirmSessionId,
  };

  return (
    <div className="shop-root">
      <div className="shop-container">
        <nav className="nav">
          <a href="#" onClick={(e) => { e.preventDefault(); goTo("home"); }} style={{ display: "flex", alignItems: "center", marginRight: 20 }}>
            <img src="/Shop_1104_Logo.jpg" alt="Shop 1104" style={{ height: 40, width: 40, objectFit: "contain" }} onError={(e) => (e.target.style.display = "none")} />
          </a>
          {NAV_LINKS.map((l) => (
            <a
              key={l.screen}
              href="#"
              aria-current={screen === l.screen ? "page" : undefined}
              onClick={(e) => {
                e.preventDefault();
                goTo(l.screen);
              }}
            >
              {l.label}
            </a>
          ))}
          <a
            href="#"
            aria-current={screen === "cart" ? "page" : undefined}
            onClick={(e) => {
              e.preventDefault();
              goTo("cart");
            }}
            style={{ marginLeft: "auto" }}
          >
            Cart ({cartState.count})
          </a>
          <a
            href="#"
            aria-current={screen === "admin" ? "page" : undefined}
            onClick={(e) => {
              e.preventDefault();
              goTo("admin");
            }}
            style={{ fontSize: 12, opacity: 0.6 }}
          >
            Admin
          </a>
        </nav>

        {screen === "home" && <Home {...screenProps} onSelectProduct={(id) => goTo("product", { productId: id })} />}
        {screen === "shop" && <Shop {...screenProps} onSelectProduct={(id) => goTo("product", { productId: id })} />}
        {screen === "product" && <ProductDetail {...screenProps} onBack={() => goTo(productOrigin.current)} />}
        {screen === "cart" && <Cart {...screenProps} onCheckout={() => goTo("checkout")} />}
        {screen === "checkout" && <Checkout {...screenProps} />}
        {screen === "confirm" && <Confirmation {...screenProps} onContinue={() => { cartState.clear(); goTo("home"); }} />}
        {screen === "custom" && <CustomOrder {...screenProps} />}
        {screen === "catalog" && <CatalogPage {...screenProps} />}
        {screen === "contact" && <Contact {...screenProps} />}
        {screen === "portal" && <ClientPortal {...screenProps} onOpenProduct={(id) => goTo("product", { productId: id })} />}
        {screen === "admin" && <Admin {...screenProps} />}

        <footer style={{ marginTop: 40, padding: "30px 0", display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 20, flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <img src="/Shop_1104_Logo.jpg" alt="Shop 1104" style={{ height: 48, width: 48, objectFit: "contain" }} onError={(e) => (e.target.style.display = "none")} />
            <span className="text-muted" style={{ fontSize: 12 }}>© {new Date().getFullYear()} Shop 1104. Local &amp; custom embroidery.</span>
          </div>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
            {NAV_LINKS.map((l) => (
              <a
                key={l.screen}
                href="#"
                style={{ fontSize: 13 }}
                onClick={(e) => {
                  e.preventDefault();
                  goTo(l.screen);
                }}
              >
                {l.label}
              </a>
            ))}
          </div>
        </footer>
      </div>
    </div>
  );
}
