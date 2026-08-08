import { useState, useEffect, useCallback } from "react";
import PreorderIntakeForm from "./components/PreorderIntakeForm";
import SalesAdminPanel from "./components/SalesAdminPanel";
import ShopApp from "./shop/ShopApp";

const LOGO_URL = "/Shop_1104_Logo.jpg";

// ── URL routing (lightweight, no router library needed) ─────────────────────
// Maps a browser path like "/preorder" to the internal page name, and back.
// This is what makes each page a real, shareable link instead of just
// internal state that resets to the homepage on refresh.
const ROUTABLE_PAGES = ["about","gallery","catalog","order","clients","admin","preorder","salesadmin","shop","product","cart","checkout","custom","contact"];
// General storefront pages, rebuilt to match the Shop1104.dc.html mockup —
// this replaces the old preorder-campaign flow as the site's primary
// experience (see sql/2026-08-07_general_catalog.sql). ShopApp owns its own
// nav/CSS/sub-screen state; App.jsx just mounts it for these page values
// instead of falling through to the legacy branches below. The old
// preorder/salesadmin pages are left in place, reachable directly by URL,
// until they're removed for good.
const GENERAL_SHOP_PAGES = new Set(["home","shop","product","cart","checkout","custom","catalog","contact","clients","admin"]);
function pathToPage(pathname){
  const parts=(pathname||"/").replace(/^\/|\/$/g,"").split("/");
  const slug=parts[0]||"";
  return ROUTABLE_PAGES.includes(slug)?slug:"home";
}
// For /preorder/some-slug, returns "some-slug"; for bare /preorder, returns null.
function pathToPreorderSlug(pathname){
  const parts=(pathname||"/").replace(/^\/|\/$/g,"").split("/");
  return parts[0]==="preorder" && parts[1] ? parts[1] : null;
}
function pageToPath(page){
  return page==="home" ? "/" : `/${page}`;
}

// ── API helpers ─────────────────────────────────────────────────────────────
// Everything here talks to Netlify Functions backed by Supabase. Public
// reads need no auth. Admin writes send the code the person typed at
// /admin in an x-admin-code header, checked server-side against
// ADMIN_ACCESS_CODE — the actual code never ships in the page's JavaScript.
async function apiGet(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Request failed");
  return res.json();
}
async function apiAdminGet(url, code) {
  const res = await fetch(url, { headers: { "x-admin-code": code } });
  if (!res.ok) throw new Error(res.status === 401 ? "Incorrect admin code." : "Request failed.");
  return res.json();
}
async function apiAdminPost(url, code, payload) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-admin-code": code },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Request failed.");
  }
  return res.json();
}

const FN = {
  siteContent: "/.netlify/functions/get-site-content",
  adminSiteContent: "/.netlify/functions/admin-site-content",
  portal: "/.netlify/functions/get-portal",
  adminPortals: "/.netlify/functions/admin-portals",
};

// Converts a DB row (snake_case) for list-based content back into the
// camelCase shape the frontend already uses.
function mapListItem(resource, row) {
  if (!row) return null;
  switch (resource) {
    case "gallery":
      return { id: row.id, label: row.label, bg: row.bg, title: row.title, desc: row.description, image: row.image_data || "" };
    case "threads":
      return { id: row.id, name: row.name, code: row.code, hex: row.hex };
    case "fonts":
      return { id: row.id, name: row.name, sample: row.sample, cssFamily: row.css_family, cssExtra: row.css_extra, desc: row.description };
    case "fontPackages":
      return { id: row.id, name: row.name, desc: row.description, resourceUrl: row.resource_url, resourceLabel: row.resource_label };
    case "designs":
      return { id: row.id, name: row.name, category: row.category, files: row.files };
    default:
      return row;
  }
}

// ── CSS ───────────────────────────────────────────────────────────────────────
function buildCSS(s) {
  const g = s.colorGreen, bg = s.colorBg;
  return `
@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Jost:wght@300;400;500;600&family=Crimson+Pro:ital,wght@0,300;0,400;1,300&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
:root{
  --bg:${s.colorBg};--blue:${s.colorBlue};--pink:${s.colorPink};
  --yellow:${s.colorYellow};--green:${g};--ink:${s.colorInk};
  --ink-soft:color-mix(in srgb,${s.colorInk} 65%,transparent);
  --ink-muted:color-mix(in srgb,${s.colorInk} 40%,transparent);
  --border:color-mix(in srgb,${s.colorInk} 10%,transparent);
  --card-bg:rgba(255,255,255,0.65);
  --green-dk:color-mix(in srgb,${g} 80%,black);
}
html{scroll-behavior:smooth;}
body{font-family:'Jost',sans-serif;background:var(--bg);color:var(--ink);min-height:100vh;}
.blob{position:absolute;pointer-events:none;z-index:0;}

nav{position:fixed;top:0;left:0;right:0;z-index:200;background:color-mix(in srgb,${bg} 88%,transparent);backdrop-filter:blur(14px);border-bottom:1px solid var(--border);height:68px;display:flex;align-items:center;justify-content:space-between;padding:0 2.5rem;}
.nav-logo{cursor:pointer;display:flex;align-items:center;gap:.6rem;}
.nav-logo img{height:46px;width:46px;object-fit:cover;border-radius:50%;}
.nav-logo-text{font-family:'DM Serif Display',serif;font-size:1.15rem;color:var(--ink);line-height:1.1;}
.nav-logo-sub{font-size:.6rem;letter-spacing:.18em;text-transform:uppercase;color:var(--green);font-family:'Jost',sans-serif;font-weight:500;}
.nav-links{display:flex;gap:1.75rem;list-style:none;}
.nav-links a{font-size:.78rem;font-weight:500;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-soft);text-decoration:none;cursor:pointer;transition:color .2s;position:relative;padding-bottom:2px;}
.nav-links a::after{content:'';position:absolute;bottom:0;left:0;right:0;height:1.5px;background:var(--green);transform:scaleX(0);transition:transform .25s;transform-origin:left;}
.nav-links a:hover::after,.nav-links a.active::after{transform:scaleX(1);}
.nav-links a:hover,.nav-links a.active{color:var(--green);}
.nav-admin-btn{font-size:.72rem;font-weight:500;letter-spacing:.08em;text-transform:uppercase;padding:.45rem 1.1rem;border:1.5px solid var(--border);border-radius:100px;background:transparent;color:var(--ink-soft);cursor:pointer;transition:all .2s;font-family:'Jost',sans-serif;}
.nav-admin-btn:hover{background:var(--green);color:white;border-color:var(--green);}

.page{padding-top:68px;min-height:100vh;}

.btn-primary{display:inline-block;padding:.85rem 2rem;background:var(--green);color:white;border:none;border-radius:100px;font-size:.8rem;font-weight:600;letter-spacing:.1em;text-transform:uppercase;cursor:pointer;transition:background .2s,transform .15s;font-family:'Jost',sans-serif;}
.btn-primary:hover{background:var(--green-dk);transform:translateY(-1px);}
.btn-outline{display:inline-block;padding:.85rem 2rem;background:transparent;border:1.5px solid var(--ink);border-radius:100px;color:var(--ink);font-size:.8rem;font-weight:600;letter-spacing:.1em;text-transform:uppercase;cursor:pointer;transition:all .2s;font-family:'Jost',sans-serif;}
.btn-outline:hover{background:var(--ink);color:var(--bg);}
.btn-sm-green{padding:.4rem 1rem;font-size:.72rem;letter-spacing:.06em;text-transform:uppercase;border:1.5px solid var(--green);border-radius:100px;background:transparent;cursor:pointer;color:var(--green);font-family:'Jost',sans-serif;transition:all .2s;white-space:nowrap;}
.btn-sm-green:hover{background:var(--green);color:white;}
.btn-sm-ghost{padding:.4rem 1rem;font-size:.72rem;letter-spacing:.06em;text-transform:uppercase;border:1.5px solid var(--border);border-radius:100px;background:transparent;cursor:pointer;color:var(--ink-soft);font-family:'Jost',sans-serif;transition:all .2s;white-space:nowrap;}
.btn-sm-ghost:hover{background:var(--green);color:white;border-color:var(--green);}
.btn-sm-danger{padding:.4rem 1rem;font-size:.72rem;letter-spacing:.06em;text-transform:uppercase;border:1.5px solid #e8a0a0;border-radius:100px;background:transparent;cursor:pointer;color:#c0392b;font-family:'Jost',sans-serif;transition:all .2s;white-space:nowrap;}
.btn-sm-danger:hover{background:#c0392b;color:white;border-color:#c0392b;}

.hero{min-height:calc(100vh - 68px);display:flex;align-items:center;padding:5rem 2.5rem 4rem;position:relative;overflow:hidden;}
.hero-inner{max-width:1200px;margin:0 auto;width:100%;display:grid;grid-template-columns:1fr 1fr;gap:4rem;align-items:center;position:relative;z-index:1;}
.hero-eyebrow{font-size:.72rem;letter-spacing:.22em;text-transform:uppercase;color:var(--green);font-weight:600;margin-bottom:1.25rem;display:flex;align-items:center;gap:.6rem;}
.hero-eyebrow::before{content:'';display:inline-block;width:28px;height:1.5px;background:var(--green);}
.hero h1{font-family:'DM Serif Display',serif;font-size:clamp(2.8rem,5vw,4.5rem);font-weight:400;line-height:1.08;color:var(--ink);margin-bottom:1.5rem;}
.hero h1 em{font-style:italic;color:var(--green);}
.hero-sub{font-family:'Crimson Pro',serif;font-size:1.2rem;font-weight:300;line-height:1.75;color:var(--ink-soft);margin-bottom:2.5rem;max-width:420px;}
.hero-actions{display:flex;gap:1rem;flex-wrap:wrap;}
.hero-logo-img{width:min(460px,100%);border-radius:24px;position:relative;z-index:1;filter:drop-shadow(0 16px 48px rgba(0,0,0,.1));}

.section{padding:6rem 2.5rem;max-width:1200px;margin:0 auto;position:relative;}
.section-label{font-size:.7rem;letter-spacing:.22em;text-transform:uppercase;color:var(--green);font-weight:600;margin-bottom:.75rem;display:flex;align-items:center;gap:.5rem;}
.section-label::before{content:'';display:inline-block;width:20px;height:1.5px;background:var(--green);}
.section-title{font-family:'DM Serif Display',serif;font-size:clamp(2rem,3.5vw,3rem);font-weight:400;color:var(--ink);line-height:1.1;}
.section-body{font-family:'Crimson Pro',serif;font-size:1.15rem;line-height:1.8;color:var(--ink-soft);}

.features-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:1.5rem;margin-top:3rem;}
.feature-card{background:var(--card-bg);backdrop-filter:blur(8px);border:1px solid var(--border);border-radius:16px;padding:2rem;transition:transform .25s,box-shadow .25s;}
.feature-card:hover{transform:translateY(-5px);box-shadow:0 16px 40px rgba(0,0,0,.08);}
.feature-pill{display:inline-flex;align-items:center;justify-content:center;width:48px;height:48px;border-radius:12px;margin-bottom:1.25rem;font-size:1.4rem;}
.feature-card h3{font-family:'DM Serif Display',serif;font-size:1.1rem;margin-bottom:.5rem;color:var(--ink);}
.feature-card p{font-size:.88rem;color:var(--ink-muted);line-height:1.65;}

.gallery-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:1.5rem;margin-top:3rem;}
.gallery-card{background:var(--card-bg);border:1px solid var(--border);border-radius:16px;overflow:hidden;cursor:pointer;transition:transform .25s,box-shadow .25s;}
.gallery-card:hover{transform:translateY(-5px);box-shadow:0 16px 40px rgba(0,0,0,.09);}
.gallery-img{width:100%;aspect-ratio:4/3;display:flex;align-items:center;justify-content:center;font-size:3.5rem;overflow:hidden;}
.gallery-img img{width:100%;height:100%;object-fit:cover;}
.gallery-info{padding:1.25rem;}
.gallery-info h4{font-family:'DM Serif Display',serif;font-size:1rem;color:var(--ink);margin-bottom:.3rem;}
.gallery-info p{font-size:.82rem;color:var(--ink-muted);}

.catalog-tabs{display:flex;gap:.5rem;margin-bottom:3rem;flex-wrap:wrap;}
.catalog-tab{padding:.6rem 1.5rem;cursor:pointer;font-size:.78rem;letter-spacing:.1em;text-transform:uppercase;border:1.5px solid var(--border);border-radius:100px;background:transparent;color:var(--ink-soft);font-family:'Jost',sans-serif;font-weight:500;transition:all .2s;}
.catalog-tab.active{background:var(--green);color:white;border-color:var(--green);}
.catalog-tab:hover:not(.active){border-color:var(--green);color:var(--green);}
.thread-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(90px,1fr));gap:1.25rem;}
.thread-swatch{display:flex;flex-direction:column;align-items:center;gap:.5rem;cursor:pointer;}
.swatch-circle{width:60px;height:60px;border-radius:50%;border:3px solid white;box-shadow:0 2px 10px rgba(0,0,0,.13);transition:transform .2s;}
.thread-swatch:hover .swatch-circle{transform:scale(1.12);}
.swatch-name{font-size:.68rem;color:var(--ink-soft);text-align:center;}
.swatch-code{font-size:.62rem;color:var(--green);font-weight:600;}
.font-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:1.5rem;}
.font-card{background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:1.75rem;transition:border-color .2s,transform .2s;}
.font-card:hover{border-color:var(--green);transform:translateY(-3px);}
.font-sample{font-size:2.2rem;margin-bottom:.6rem;color:var(--ink);line-height:1.15;}
.font-meta{font-size:.68rem;color:var(--green);letter-spacing:.12em;text-transform:uppercase;font-weight:600;}
.font-name{font-size:.85rem;color:var(--ink-muted);margin-top:.2rem;}
.design-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:1.25rem;}
.design-card{background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:1.5rem;text-align:center;cursor:pointer;transition:all .2s;}
.design-card:hover{border-color:var(--green);background:white;}
.design-files{margin-top:.4rem;font-size:.7rem;color:var(--green);font-weight:600;}
.package-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:1.5rem;}
.package-card{background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:1.75rem;transition:all .2s;}
.package-card:hover{border-color:var(--green);transform:translateY(-3px);}
.package-card h4{font-family:'DM Serif Display',serif;font-size:1.05rem;color:var(--ink);margin-bottom:.5rem;}
.package-card p{font-size:.85rem;color:var(--ink-muted);line-height:1.6;margin-bottom:1.1rem;}

.order-layout{display:grid;grid-template-columns:1fr 400px;gap:3.5rem;align-items:start;}
.order-form{display:flex;flex-direction:column;gap:1.25rem;}
.form-group{display:flex;flex-direction:column;gap:.4rem;}
.form-group label{font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-soft);font-weight:600;}
.form-group input,.form-group select,.form-group textarea{padding:.85rem 1.1rem;border:1.5px solid var(--border);border-radius:10px;background:var(--card-bg);font-family:'Jost',sans-serif;font-size:.92rem;color:var(--ink);outline:none;transition:border-color .2s;}
.form-group input:focus,.form-group select:focus,.form-group textarea:focus{border-color:var(--green);}
.form-group textarea{resize:vertical;min-height:100px;}
.order-sidebar{background:var(--card-bg);border:1px solid var(--border);border-radius:20px;padding:2.25rem;position:sticky;top:84px;}
.order-sidebar h3{font-family:'DM Serif Display',serif;font-size:1.3rem;color:var(--ink);margin-bottom:1.5rem;padding-bottom:1rem;border-bottom:1px solid var(--border);}
.how-step{display:flex;gap:1rem;margin-bottom:1.25rem;}
.step-num{min-width:28px;height:28px;border-radius:50%;background:var(--green);color:white;display:flex;align-items:center;justify-content:center;font-size:.72rem;font-weight:700;margin-top:2px;flex-shrink:0;}
.step-title{font-weight:600;font-size:.88rem;color:var(--ink);margin-bottom:.2rem;}
.step-desc{font-size:.8rem;color:var(--ink-muted);line-height:1.6;}
.stripe-badge{margin-top:1.5rem;padding:.75rem 1rem;background:#f0faf3;border-radius:10px;font-size:.75rem;color:var(--green);text-align:center;font-weight:500;}

.about-layout{display:grid;grid-template-columns:1fr 1fr;gap:5rem;align-items:center;}
.stats-row{display:flex;gap:2.5rem;padding:2rem 0;border-top:1px solid var(--border);border-bottom:1px solid var(--border);margin:1.5rem 0;flex-wrap:wrap;}
.stat-num{font-family:'DM Serif Display',serif;font-size:2.8rem;color:var(--green);display:block;}
.stat-label{font-size:.82rem;color:var(--ink-muted);margin-top:.1rem;}

/* CLIENT PORTAL */
.portal-lock{max-width:460px;margin:8rem auto;text-align:center;padding:0 2rem;}
.lock-blob{width:100px;height:100px;margin:0 auto 2rem;border-radius:40% 60% 50% 50%/60% 40% 60% 40%;background:var(--pink);display:flex;align-items:center;justify-content:center;}
.portal-lock h2{font-family:'DM Serif Display',serif;font-size:2.2rem;color:var(--ink);margin-bottom:.75rem;}
.portal-lock p{color:var(--ink-muted);margin-bottom:2rem;line-height:1.7;font-family:'Crimson Pro',serif;font-size:1.1rem;}
.code-input{width:100%;padding:1rem 1.25rem;text-align:center;font-size:1.6rem;letter-spacing:.3em;border-radius:12px;border:1.5px solid var(--border);background:var(--card-bg);font-family:'Jost',sans-serif;color:var(--ink);outline:none;transition:border-color .2s;margin-bottom:1rem;}
.code-input:focus{border-color:var(--green);}
.portal-error{color:#c0392b;font-size:.85rem;margin-bottom:.75rem;}
.client-header{background:var(--green);color:white;padding:1.5rem 2.5rem;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:1rem;}
.client-header h2{font-family:'DM Serif Display',serif;font-size:1.4rem;}
.client-header p{font-size:.78rem;opacity:.8;margin-top:.2rem;}
.client-header-actions{display:flex;align-items:center;gap:.75rem;}
.cart-btn{position:relative;background:rgba(255,255,255,.15);border:1.5px solid rgba(255,255,255,.35);border-radius:100px;padding:.5rem 1.1rem;color:white;cursor:pointer;font-family:'Jost',sans-serif;font-size:.78rem;font-weight:600;letter-spacing:.06em;display:flex;align-items:center;gap:.5rem;transition:background .2s;}
.cart-btn:hover{background:rgba(255,255,255,.25);}
.cart-badge{background:var(--pink);color:var(--ink);border-radius:100px;padding:.1rem .45rem;font-size:.65rem;font-weight:700;min-width:18px;text-align:center;}
.client-products{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:1.5rem;padding:2.5rem;}
.client-product-card{background:var(--card-bg);border:1px solid var(--border);border-radius:16px;overflow:hidden;}
.product-img{width:100%;aspect-ratio:4/3;display:flex;align-items:center;justify-content:center;overflow:hidden;}
.product-img img{width:100%;height:100%;object-fit:cover;}
.product-info{padding:1.25rem;}
.product-info h4{font-family:'DM Serif Display',serif;font-size:1rem;color:var(--ink);}
.product-price{color:var(--green);font-weight:700;margin:.4rem 0;font-size:1rem;}
.product-info p{font-size:.82rem;color:var(--ink-muted);line-height:1.55;}
/* LOCKED PORTAL */
.locked-portal{max-width:480px;margin:6rem auto;text-align:center;padding:2rem;}
.locked-portal h2{font-family:'DM Serif Display',serif;font-size:2rem;color:var(--ink);margin-bottom:.75rem;}

/* CART */
.cart-page{max-width:860px;margin:0 auto;padding:2.5rem;}
.cart-page h2{font-family:'DM Serif Display',serif;font-size:1.8rem;color:var(--ink);margin-bottom:2rem;}
.cart-item{background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:1.25rem;margin-bottom:1rem;display:grid;grid-template-columns:80px 1fr auto;gap:1rem;align-items:center;}
.cart-item-img{width:80px;height:80px;border-radius:10px;overflow:hidden;flex-shrink:0;}
.cart-item-img img{width:100%;height:100%;object-fit:cover;}
.cart-item-img-placeholder{width:80px;height:80px;border-radius:10px;display:flex;align-items:center;justify-content:center;}
.cart-item-info h4{font-size:.95rem;color:var(--ink);font-weight:500;margin-bottom:.2rem;}
.cart-item-info p{font-size:.78rem;color:var(--ink-muted);line-height:1.5;}
.cart-item-price{font-weight:700;color:var(--green);font-size:.95rem;white-space:nowrap;}
.qty-control{display:flex;align-items:center;gap:.5rem;margin-top:.5rem;}
.qty-btn{width:26px;height:26px;border-radius:50%;border:1.5px solid var(--border);background:transparent;cursor:pointer;font-size:.9rem;display:flex;align-items:center;justify-content:center;color:var(--ink);transition:all .15s;}
.qty-btn:hover{background:var(--green);border-color:var(--green);color:white;}
.qty-val{font-size:.88rem;font-weight:600;min-width:20px;text-align:center;color:var(--ink);}
.cart-summary{background:var(--card-bg);border:1px solid var(--border);border-radius:16px;padding:1.75rem;margin-top:1.5rem;}
.cart-total-row{display:flex;justify-content:space-between;font-size:.88rem;color:var(--ink-soft);margin-bottom:.6rem;}
.cart-total-row.total{font-size:1.1rem;font-weight:700;color:var(--ink);border-top:1px solid var(--border);padding-top:.75rem;margin-top:.75rem;}
.checkout-layout{display:grid;grid-template-columns:1fr 360px;gap:2.5rem;margin-top:2rem;align-items:start;}
.checkout-done{text-align:center;padding:3rem 2rem;}
.checkout-done h3{font-family:'DM Serif Display',serif;font-size:2rem;color:var(--ink);margin-bottom:.75rem;}
.checkout-done p{font-family:'Crimson Pro',serif;font-size:1.1rem;color:var(--ink-muted);line-height:1.7;margin-bottom:1.5rem;}

/* ADMIN */
.admin-wrap{display:grid;grid-template-columns:240px 1fr;min-height:calc(100vh - 68px);}
.admin-side{background:var(--green);padding:1.75rem 1.25rem;display:flex;flex-direction:column;gap:.2rem;}
.admin-side-logo{display:flex;align-items:center;gap:.6rem;margin-bottom:1.75rem;padding-bottom:1.25rem;border-bottom:1px solid rgba(255,255,255,.15);}
.admin-side-logo img{width:38px;height:38px;object-fit:cover;border-radius:50%;border:2px solid rgba(255,255,255,.25);}
.admin-side-logo span{font-family:'DM Serif Display',serif;color:white;font-size:1rem;}
.admin-nav{padding:.65rem 1rem;cursor:pointer;border-radius:10px;font-size:.8rem;color:rgba(255,255,255,.65);transition:all .15s;display:flex;gap:.75rem;align-items:center;font-family:'Jost',sans-serif;white-space:nowrap;}
.admin-nav:hover{background:rgba(255,255,255,.1);color:white;}
.admin-nav.active{background:rgba(255,255,255,.2);color:white;font-weight:600;}
.admin-nav-section{font-size:.62rem;letter-spacing:.15em;text-transform:uppercase;color:rgba(255,255,255,.35);padding:.75rem 1rem .25rem;font-family:'Jost',sans-serif;}
.admin-main{padding:2.5rem;background:var(--bg);overflow-y:auto;}
.admin-header{margin-bottom:2rem;padding-bottom:1.25rem;border-bottom:1px solid var(--border);}
.admin-header h2{font-family:'DM Serif Display',serif;font-size:1.8rem;color:var(--ink);margin-bottom:.25rem;}
.admin-header p{font-size:.88rem;color:var(--ink-muted);}
.acard{background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:1.5rem;margin-bottom:.875rem;}
.acard-row{display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap;}
.acard-info h4{font-size:.95rem;color:var(--ink);margin-bottom:.25rem;font-weight:500;}
.acard-info p{font-size:.8rem;color:var(--ink-muted);}
.acard-actions{display:flex;gap:.5rem;flex-shrink:0;}
.aform{background:var(--card-bg);border:1.5px solid var(--green);border-radius:16px;padding:2rem;margin-bottom:1.5rem;}
.aform h3{font-family:'DM Serif Display',serif;font-size:1.15rem;color:var(--ink);margin-bottom:1.25rem;}
.form-row{display:grid;grid-template-columns:1fr 1fr;gap:1rem;}
.form-row-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:1rem;}
.edit-form{background:#f5fdf7;border:1.5px solid var(--green);border-radius:12px;padding:1.5rem;margin-top:.75rem;}
.edit-form h4{font-family:'DM Serif Display',serif;font-size:1rem;color:var(--ink);margin-bottom:1rem;}
.color-row{display:flex;gap:1rem;align-items:center;flex-wrap:wrap;}
.color-field{display:flex;flex-direction:column;gap:.35rem;align-items:center;}
.color-field label{font-size:.65rem;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-muted);font-weight:600;text-align:center;}
.color-field input[type=color]{width:52px;height:52px;border-radius:12px;border:2px solid var(--border);cursor:pointer;padding:2px;}
.code-badge{display:inline-block;background:var(--green);color:white;padding:.2rem .75rem;border-radius:100px;font-size:.72rem;font-weight:700;letter-spacing:.12em;}
.lock-badge{display:inline-block;background:#fef3c7;color:#92400e;padding:.2rem .75rem;border-radius:100px;font-size:.72rem;font-weight:700;border:1px solid #fcd34d;}
.upload-area{border:2px dashed var(--border);border-radius:10px;padding:1.25rem;text-align:center;cursor:pointer;transition:border-color .2s;background:rgba(255,255,255,.5);}
.upload-area:hover{border-color:var(--green);}
.upload-preview{width:100%;max-height:160px;object-fit:cover;border-radius:8px;margin-top:.75rem;}

footer{background:var(--ink);color:rgba(235,232,232,.6);padding:3rem 2.5rem;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:1.5rem;}
.footer-logo{display:flex;align-items:center;gap:.75rem;}
.footer-logo img{width:40px;height:40px;object-fit:cover;border-radius:50%;opacity:.9;}
.footer-logo-text{font-family:'DM Serif Display',serif;color:white;font-size:1.1rem;}
.footer-logo-sub{font-size:.62rem;letter-spacing:.15em;text-transform:uppercase;color:${g};}
footer p{font-size:.78rem;}
.footer-links{display:flex;gap:1.5rem;flex-wrap:wrap;}
.footer-links a{font-size:.78rem;color:rgba(235,232,232,.45);text-decoration:none;cursor:pointer;transition:color .2s;}
.footer-links a:hover{color:${g};}

.toast{position:fixed;bottom:2rem;right:2rem;z-index:999;background:var(--green);color:white;padding:.9rem 1.75rem;border-radius:100px;font-size:.85rem;font-weight:500;box-shadow:0 8px 24px rgba(82,128,95,.3);animation:popUp .3s cubic-bezier(.34,1.56,.64,1);}
@keyframes popUp{from{opacity:0;transform:translateY(16px) scale(.92);}to{opacity:1;transform:none;}}

.section-sep{border:none;border-top:1px solid var(--border);margin:0;}

@media(max-width:900px){
  .hero-inner,.order-layout,.about-layout,.checkout-layout{grid-template-columns:1fr;}
  .admin-wrap{grid-template-columns:1fr;}
  .admin-side{display:none;}
  nav{padding:0 1rem;}
  .nav-links{display:none;}
  .form-row,.form-row-3{grid-template-columns:1fr;}
  .cart-item{grid-template-columns:60px 1fr auto;}
}
`;
}

// ── Fallback defaults (used only if the site content API can't be reached) ──
const DEFAULTS = {
  settings:{
    businessName:"Shop 1104",tagline:"Apparel · Embroidery",
    email:"shop1104@gmail.com",phone:"(515)-777-6636",
    address:"Indianola, Iowa",website:"shop1104.com",
    colorBg:"#ebe8e8",colorGreen:"#52805f",colorBlue:"#c5e0f2",
    colorPink:"#f2b0aa",colorYellow:"#eee5ad",colorInk:"#1e1e1e",
    taxRate:"7",
    invoiceDueDays:"14",
    thankYouMessage:"Thank you for your Business! We appreciate your support and look forward to working with you again in the future!",
    turnaroundNote:"Please reach out for additional information on Turnaround times. The production time may differ as garment orders can vary based on each customers desired needs.",
    termsConditions:"All orders are considered confirmed and can begin fulfillment after payment is received.",
  },
  hero:{
    eyebrow:"Custom Embroidery · Est. 2015",
    headline:"Stitched with *care*, made to last.",
    subheadline:"From monograms to bulk corporate orders — every piece crafted with intention right here in our studio.",
    cta1:"Place an Order",cta2:"View Our Work",
  },
  about:{
    eyebrow:"Our Story",headline:"A decade of dedication to the craft",
    body1:"Founded in 2015, Shop 1104 started as a one-machine operation out of a home studio. Today we serve hundreds of clients — from brides and sports teams to hotels and corporate brands — without ever losing the care that defines every piece we make.",
    body2:"We specialize in high-fidelity embroidery that holds its shape wash after wash. Every file is digitized in-house and test-stitched before production.",
    stat1num:"10+",stat1label:"Years in business",stat2num:"5k+",stat2label:"Orders completed",stat3num:"200+",stat3label:"Thread colors",
    cta:"Work With Us",
  },
  gallery:[], threads:[], fonts:[], fontPackages:[], designs:[],
};

function genId(){return Date.now()+Math.floor(Math.random()*1000);}

function resizeImage(file,cb){
  const reader=new FileReader();
  reader.onload=ev=>{
    const img=new Image();
    img.onload=()=>{
      const max=800,canvas=document.createElement('canvas');
      let w=img.width,h=img.height;
      if(w>max){h=Math.round(h*max/w);w=max;}
      if(h>max){w=Math.round(w*max/h);h=max;}
      canvas.width=w;canvas.height=h;
      canvas.getContext('2d').drawImage(img,0,0,w,h);
      cb(canvas.toDataURL('image/jpeg',0.82));
    };
    img.src=ev.target.result;
  };
  reader.readAsDataURL(file);
}

function generateInvoicePDF({settings, portal, portalCode, checkoutForm, cartItems, cartTotal, invoiceNumber, invoiceDate, dueDate}){
  const taxRate = parseFloat(settings.taxRate||0)/100;
  const subtotal = cartTotal;
  const taxAmount = subtotal * taxRate;
  const grandTotal = subtotal + taxAmount;

  const itemRows = cartItems.map(item=>`
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #eee;font-size:13px;color:#1e1e1e;">${item.title}${item.placementName&&item.placementName!=="Standard"?`<br><span style="font-size:11px;color:#888;">Placement: ${item.placementName}</span>`:""}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #eee;font-size:13px;color:#1e1e1e;text-align:center;">${item.qty||1}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #eee;font-size:13px;color:#1e1e1e;text-align:right;">$${item.unitPrice.toFixed(2)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #eee;font-size:13px;color:#1e1e1e;text-align:right;font-weight:600;">$${(item.unitPrice*(item.qty||1)).toFixed(2)}</td>
    </tr>
  `).join("");

  const html=`<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<title>Invoice ${invoiceNumber}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;background:#fff;color:#1e1e1e;font-size:14px;}
  .page{max-width:780px;margin:0 auto;padding:48px 48px 64px;}
  .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:40px;padding-bottom:32px;border-bottom:2px solid #52805f;}
  .brand-name{font-size:26px;font-weight:700;color:#52805f;letter-spacing:-0.5px;}
  .brand-sub{font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#888;margin-top:3px;}
  .brand-contact{font-size:12px;color:#555;margin-top:8px;line-height:1.7;}
  .invoice-title{text-align:right;}
  .invoice-title h1{font-size:32px;font-weight:700;color:#1e1e1e;letter-spacing:-1px;}
  .invoice-title .inv-num{font-size:13px;color:#52805f;font-weight:600;margin-top:4px;}
  .invoice-title .inv-dates{font-size:12px;color:#888;margin-top:6px;line-height:1.7;}
  .bill-section{display:flex;justify-content:space-between;margin-bottom:36px;gap:24px;}
  .bill-box{flex:1;background:#f7f7f7;border-radius:8px;padding:18px 20px;}
  .bill-box h3{font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#888;margin-bottom:10px;font-weight:600;}
  .bill-box p{font-size:13px;color:#1e1e1e;line-height:1.7;}
  .bill-box .code{display:inline-block;background:#52805f;color:white;font-size:10px;font-weight:700;padding:2px 10px;border-radius:100px;letter-spacing:1px;margin-top:6px;}
  table{width:100%;border-collapse:collapse;margin-bottom:8px;}
  thead{background:#52805f;}
  thead th{padding:11px 12px;font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:white;text-align:left;}
  thead th:nth-child(2){text-align:center;}
  thead th:nth-child(3),thead th:nth-child(4){text-align:right;}
  .totals{margin-left:auto;width:300px;margin-top:4px;}
  .total-row{display:flex;justify-content:space-between;padding:7px 12px;font-size:13px;color:#555;}
  .total-row.grand{background:#52805f;color:white;border-radius:8px;padding:12px 16px;font-size:15px;font-weight:700;margin-top:4px;}
  .notes-box{margin-top:32px;background:#f7f7f7;border-radius:8px;padding:16px 20px;}
  .notes-box h3{font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#888;margin-bottom:8px;font-weight:600;}
  .notes-box p{font-size:13px;color:#555;line-height:1.65;}
  .footer-section{margin-top:36px;padding-top:24px;border-top:1px solid #eee;}
  .thank-you{font-size:14px;color:#52805f;font-weight:600;margin-bottom:12px;}
  .footer-note{font-size:11px;color:#999;line-height:1.7;margin-bottom:6px;}
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div>
      <div class="brand-name">${settings.businessName}</div>
      <div class="brand-sub">${settings.tagline}</div>
      <div class="brand-contact">
        ${settings.address}<br>
        ${settings.phone} · ${settings.email}<br>
        ${settings.website}
      </div>
    </div>
    <div class="invoice-title">
      <h1>INVOICE</h1>
      <div class="inv-num">#${invoiceNumber}</div>
      <div class="inv-dates">
        Date: ${invoiceDate}<br>
        Due: ${dueDate}
      </div>
    </div>
  </div>

  <div class="bill-section">
    <div class="bill-box">
      <h3>Billed To</h3>
      <p><strong>${portal.name}</strong><br>
      ${checkoutForm.name}<br>
      ${checkoutForm.phone||""}</p>
      <div class="code">${portalCode}</div>
    </div>
    <div class="bill-box">
      <h3>Order Summary</h3>
      <p>${cartItems.length} item type${cartItems.length!==1?"s":""}<br>
      ${cartItems.reduce((s,i)=>s+(i.qty||1),0)} total units</p>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Item / Placement</th>
        <th style="text-align:center;">Qty</th>
        <th style="text-align:right;">Unit Price</th>
        <th style="text-align:right;">Total</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <div class="totals">
    <div class="total-row"><span>Subtotal</span><span>$${subtotal.toFixed(2)}</span></div>
    <div class="total-row"><span>Tax (${settings.taxRate}%)</span><span>$${taxAmount.toFixed(2)}</span></div>
    <div class="total-row grand"><span>Total Due</span><span>$${grandTotal.toFixed(2)}</span></div>
  </div>

  ${checkoutForm.notes?`<div class="notes-box"><h3>Notes</h3><p>${checkoutForm.notes}</p></div>`:""}

  <div class="footer-section">
    <div class="thank-you">${settings.thankYouMessage}</div>
    <div class="footer-note">${settings.turnaroundNote}</div>
    <div class="footer-note" style="margin-top:8px;"><strong>Terms:</strong> ${settings.termsConditions}</div>
  </div>
</div>
</body>
</html>`;

  const win=window.open("","_blank");
  win.document.write(html);
  win.document.close();
  setTimeout(()=>win.print(),600);
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App(){
  const [ready,setReady]=useState(false);
  const [page,setPage]=useState(()=>pathToPage(window.location.pathname));
  const [preorderSlug,setPreorderSlug]=useState(()=>pathToPreorderSlug(window.location.pathname));

  // Admin auth: no password lives in the browser. The code the person types
  // is only ever sent as a header and checked server-side.
  const [adminUnlocked,setAdminUnlocked]=useState(false);
  const [adminCodeInput,setAdminCodeInput]=useState("");
  const [adminCode,setAdminCode]=useState("");
  const [adminLoginError,setAdminLoginError]=useState("");
  const [adminTab,setAdminTab]=useState("site");

  const [catalogTab,setCatalogTab]=useState("threads");
  const [clientCode,setClientCode]=useState("");
  const [clientError,setClientError]=useState("");
  const [activeClient,setActiveClient]=useState(null); // code string
  const [activePortalData,setActivePortalData]=useState(null); // {portal, products}
  const [cartOpen,setCartOpen]=useState(false);
  const [checkoutDone,setCheckoutDone]=useState(false);
  const [toast,setToast]=useState(null);
  const [savedPulse,setSavedPulse]=useState(false);

  const [settings,setSettings]=useState(DEFAULTS.settings);
  const [hero,setHero]=useState(DEFAULTS.hero);
  const [about,setAbout]=useState(DEFAULTS.about);
  const [gallery,setGallery]=useState(DEFAULTS.gallery);
  const [threads,setThreads]=useState(DEFAULTS.threads);
  const [fonts,setFonts]=useState(DEFAULTS.fonts);
  const [fontPackages,setFontPackages]=useState(DEFAULTS.fontPackages);
  const [designs,setDesigns]=useState(DEFAULTS.designs);

  const [adminPortals,setAdminPortals]=useState([]); // full list, admin-only

  const [cart,setCart]=useState({});
  const [selectedPlacements,setSelectedPlacements]=useState({});
  const [checkoutForm,setCheckoutForm]=useState({name:"",email:"",phone:"",notes:""});
  const [invoiceNumber,setInvoiceNumber]=useState(()=>`S1104-${Date.now().toString().slice(-6)}`);
  const [manualInvoice,setManualInvoice]=useState({
    portalKey:"", clientName:"", clientContact:"", clientPhone:"",
    dueDate:"", notes:"", items:[]
  });
  const [manualInvoiceItem,setManualInvoiceItem]=useState({name:"",qty:"1",unitPrice:""});
  const [portalInvoiceKey,setPortalInvoiceKey]=useState(null);
  const [portalInvoiceItems,setPortalInvoiceItems]=useState([]);
  const [orderForm,setOrderForm]=useState({name:"",email:"",phone:"",type:"Hat/Cap",qty:"1",colors:"",font:"",notes:""});
  const [newThread,setNewThread]=useState({name:"",code:"",hex:"#52805f"});
  const [newDesign,setNewDesign]=useState({name:"",category:"",files:"DST, PES"});
  const [newGallery,setNewGallery]=useState({label:"",bg:"#c5e0f2",title:"",desc:"",image:""});
  const [newClient,setNewClient]=useState({name:""});
  const [newFont,setNewFont]=useState({name:"",sample:"Monogram",cssFamily:"Georgia, serif",cssExtra:"",desc:""});
  const [newFontPackage,setNewFontPackage]=useState({name:"",desc:"",resourceUrl:"",resourceLabel:"View PDF"});
  const [newProduct,setNewProduct]=useState({portalKey:"",label:"",bg:"#c5e0f2",brand:"",title:"",price:"",basePrice:"",desc:"",image:"",placements:[],sizes:[]});
  const [newPlacement,setNewPlacement]=useState({name:"",extraCost:""});
  const [newSize,setNewSize]=useState({name:"",price:""});
  const [showAdd,setShowAdd]=useState({});
  const [editingPortalKey,setEditingPortalKey]=useState(null);
  const [editingPortalData,setEditingPortalData]=useState(null);
  const [editingProductKey,setEditingProductKey]=useState(null);
  const [editingProductIdx,setEditingProductIdx]=useState(null);
  const [editingProductData,setEditingProductData]=useState(null);
  // Raw get-site-content response, passed down to ShopApp so it doesn't
  // have to make its own duplicate fetch of the same endpoint.
  const [rawSiteContent,setRawSiteContent]=useState(null);

  // ── Load public site content once, on mount ──
  useEffect(()=>{
    (async()=>{
      try{
        const data=await apiGet(FN.siteContent);
        setSettings(data.settings||DEFAULTS.settings);
        setHero(data.hero||DEFAULTS.hero);
        setAbout(data.about||DEFAULTS.about);
        setGallery(data.gallery||[]);
        setThreads(data.threads||[]);
        setFonts(data.fonts||[]);
        setFontPackages(data.fontPackages||[]);
        setDesigns(data.designs||[]);
        setRawSiteContent(data);
      }catch{
        // Fall back to hardcoded defaults if the API can't be reached.
      }
      setReady(true);
    })();
  },[]);

  const showToast=(msg)=>{setToast(msg);setTimeout(()=>setToast(null),3200);};
  const nav=(p)=>{
    setPage(p);
    if(p!=="preorder") setPreorderSlug(null);
    const path=pageToPath(p);
    if(window.location.pathname!==path) window.history.pushState({},"",path);
    window.scrollTo(0,0);
  };
  const navToPreorderSlug=(slug)=>{
    setPage("preorder");
    setPreorderSlug(slug);
    const path=`/preorder/${slug}`;
    if(window.location.pathname!==path) window.history.pushState({},"",path);
    window.scrollTo(0,0);
  };

  // Keep state in sync with the browser's back/forward buttons.
  useEffect(()=>{
    const onPop=()=>{setPage(pathToPage(window.location.pathname));setPreorderSlug(pathToPreorderSlug(window.location.pathname));};
    window.addEventListener("popstate",onPop);
    return ()=>window.removeEventListener("popstate",onPop);
  },[]);
  const toggleAdd=(k)=>setShowAdd(p=>({...p,[k]:!p[k]}));
  const flashSaved=()=>{setSavedPulse(true);setTimeout(()=>setSavedPulse(false),1500);};

  // ── Admin login: verify the code against the server, don't compare locally ──
  const handleAdminLogin=async()=>{
    setAdminLoginError("");
    try{
      const data=await apiAdminGet(FN.adminPortals, adminCodeInput);
      setAdminCode(adminCodeInput);
      setAdminPortals(data.portals||[]);
      setAdminUnlocked(true);
    }catch(err){
      setAdminLoginError(err.message||"Incorrect admin code.");
    }
  };

  const refreshAdminPortals=useCallback(async()=>{
    try{
      const data=await apiAdminGet(FN.adminPortals, adminCode);
      setAdminPortals(data.portals||[]);
    }catch{
      showToast("Could not refresh portals.");
    }
  },[adminCode]);

  // ── Singleton content updates (settings/hero/about) ──
  const updateSettings=(v)=>{
    setSettings(v);
    apiAdminPost(FN.adminSiteContent, adminCode, {resource:"settings",action:"update",value:v})
      .then(flashSaved).catch(()=>showToast("Could not save settings."));
  };
  const updateHero=(v)=>{
    setHero(v);
    apiAdminPost(FN.adminSiteContent, adminCode, {resource:"hero",action:"update",value:v})
      .then(flashSaved).catch(()=>showToast("Could not save homepage content."));
  };
  const updateAbout=(v)=>{
    setAbout(v);
    apiAdminPost(FN.adminSiteContent, adminCode, {resource:"about",action:"update",value:v})
      .then(flashSaved).catch(()=>showToast("Could not save about page."));
  };

  // ── Generic list helpers (gallery/threads/fonts/fontPackages/designs) ──
  const listSetters={gallery:setGallery,threads:setThreads,fonts:setFonts,fontPackages:setFontPackages,designs:setDesigns};
  const listGetters={gallery:()=>gallery,threads:()=>threads,fonts:()=>fonts,fontPackages:()=>fontPackages,designs:()=>designs};

  const addListItem=async(resource,fields,onDone)=>{
    try{
      const {item}=await apiAdminPost(FN.adminSiteContent, adminCode, {resource,action:"create",fields});
      const mapped=mapListItem(resource,item);
      listSetters[resource]([...listGetters[resource](),mapped]);
      if(onDone)onDone();
      showToast("Added");
    }catch{
      showToast("Could not add item.");
    }
  };

  const updateListItemLocal=(resource,id,fields)=>{
    listSetters[resource](listGetters[resource]().map(x=>x.id===id?{...x,...fields}:x));
  };

  const persistListItem=(resource,id,fields)=>{
    apiAdminPost(FN.adminSiteContent, adminCode, {resource,action:"update",id,fields})
      .then(flashSaved).catch(()=>showToast("Could not save change."));
  };

  const removeListItem=async(resource,id)=>{
    try{
      await apiAdminPost(FN.adminSiteContent, adminCode, {resource,action:"delete",id});
      listSetters[resource](listGetters[resource]().filter(x=>x.id!==id));
      showToast("Removed");
    }catch{
      showToast("Could not remove item.");
    }
  };

  const isLocked=(portal)=>{
    if(!portal?.lockDate) return false;
    return new Date()>new Date(portal.lockDate);
  };

  // Cart helpers (client-side only, per browsing session — same as before)
  const cartItems=(key)=>cart[key]||[];
  const cartCount=(key)=>cartItems(key).reduce((s,i)=>s+(i.qty||1),0);
  const cartTotal=(key)=>cartItems(key).reduce((s,i)=>s+(i.unitPrice*(i.qty||1)),0);

  const addToCart=(portalKey,item)=>{
    setCart(prev=>({...prev,[portalKey]:[...(prev[portalKey]||[]),{...item,qty:1,cartId:genId()}]}));
    showToast("Added to cart");
  };
  const removeFromCart=(portalKey,cartId)=>{
    setCart(prev=>({...prev,[portalKey]:(prev[portalKey]||[]).filter(i=>i.cartId!==cartId)}));
  };
  const updateQty=(portalKey,cartId,qty)=>{
    if(qty<1){removeFromCart(portalKey,cartId);return;}
    setCart(prev=>({...prev,[portalKey]:(prev[portalKey]||[]).map(i=>i.cartId===cartId?{...i,qty}:i)}));
  };

  const css=buildCSS(settings);

  function renderHL(text){
    return text.split(/(\*[^*]+\*)/).map((p,i)=>
      p.startsWith("*")&&p.endsWith("*")?<em key={i} style={{fontStyle:"italic",color:"var(--green)"}}>{p.slice(1,-1)}</em>:p
    );
  }

  if(!ready) return(<><style>{`body{background:#ebe8e8;display:flex;align-items:center;justify-content:center;height:100vh;font-family:'Jost',sans-serif;color:#52805f;font-size:1rem;letter-spacing:.1em;}`}</style><div>Loading Shop 1104…</div></>);

  // ── General storefront (Home/Shop/Product/Cart/Checkout/Custom/Catalog/Contact/Client Portal/Admin) ──
  if(GENERAL_SHOP_PAGES.has(page)) return <ShopApp page={page} nav={nav} initialContent={rawSiteContent}/>;

  // ── Sales & Pricing admin (separate login, manages pre-order sales/products) ──
  if(page==="salesadmin") return <SalesAdminPanel/>;

  // ── Admin gate ──
  if(page==="admin"&&!adminUnlocked) return(
    <>
      <style>{css}</style>
      <nav>
        <div className="nav-logo" onClick={()=>nav("home")}>
          <img src={LOGO_URL} alt={settings.businessName}/>
          <div><div className="nav-logo-text">{settings.businessName}</div><div className="nav-logo-sub">{settings.tagline}</div></div>
        </div>
      </nav>
      <div className="page">
        <div className="portal-lock">
          <div className="lock-blob"/>
          <h2>Admin Panel</h2>
          <p>Enter your admin code to manage all site content.</p>
          <input className="code-input" type="password" placeholder="••••••••" value={adminCodeInput}
            onChange={e=>setAdminCodeInput(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&handleAdminLogin()}/>
          {adminLoginError&&<p className="portal-error">{adminLoginError}</p>}
          <button className="btn-primary" style={{width:"100%"}} onClick={handleAdminLogin}>
            Enter
          </button>
        </div>
      </div>
      {toast&&<div className="toast">{toast}</div>}
    </>
  );

  // ── Admin panel ──
  if(page==="admin"&&adminUnlocked) return(
    <>
      <style>{css}</style>
      <nav>
        <div className="nav-logo" onClick={()=>nav("home")}>
          <img src={LOGO_URL} alt={settings.businessName}/>
          <div><div className="nav-logo-text">{settings.businessName}</div><div className="nav-logo-sub">{settings.tagline}</div></div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:"1rem"}}>
          {savedPulse&&<span style={{fontSize:".78rem",color:"var(--green)",fontWeight:500}}>Saved</span>}
          <button className="btn-sm-ghost" onClick={()=>{setAdminUnlocked(false);setAdminCode("");setAdminCodeInput("");nav("home");}}>Exit Admin</button>
        </div>
      </nav>
      <div className="page">
        <div className="admin-wrap">
          <div className="admin-side">
            <div className="admin-side-logo">
              <img src={LOGO_URL} alt=""/><span>{settings.businessName}</span>
            </div>
            <div className="admin-nav-section">Content</div>
            {[["site","Settings"],["hero","Homepage"],["about","About Page"],["gallery_admin","Gallery"]].map(([t,l])=>(
              <div key={t} className={`admin-nav${adminTab===t?" active":""}`} onClick={()=>setAdminTab(t)}>{l}</div>
            ))}
            <div className="admin-nav-section" style={{marginTop:".5rem"}}>Catalog</div>
            {[["threads","Thread Colors"],["fonts","Font Styles"],["fontPackages_admin","Font Packages"],["designs","Design Files"]].map(([t,l])=>(
              <div key={t} className={`admin-nav${adminTab===t?" active":""}`} onClick={()=>setAdminTab(t)}>{l}</div>
            ))}
            <div className="admin-nav-section" style={{marginTop:".5rem"}}>Business</div>
            {[["clients","Client Portals"],["products","Portal Products"],["invoices","Invoices"]].map(([t,l])=>(
              <div key={t} className={`admin-nav${adminTab===t?" active":""}`} onClick={()=>setAdminTab(t)}>{l}</div>
            ))}
            <div className="admin-nav" onClick={()=>nav("salesadmin")}>Pre-Order Sales →</div>
          </div>

          <div className="admin-main">

            {/* SITE SETTINGS */}
            {adminTab==="site"&&<>
              <div className="admin-header"><h2>Site Settings</h2><p>Business info, brand colors, and invoice defaults.</p></div>
              <div className="aform">
                <h3>Business Info</h3>
                <div className="form-row">
                  <div className="form-group"><label>Business Name</label><input value={settings.businessName} onChange={e=>updateSettings({...settings,businessName:e.target.value})}/></div>
                  <div className="form-group"><label>Tagline</label><input value={settings.tagline} onChange={e=>updateSettings({...settings,tagline:e.target.value})}/></div>
                </div>
                <div className="form-row" style={{marginTop:"1rem"}}>
                  <div className="form-group"><label>Email</label><input value={settings.email} onChange={e=>updateSettings({...settings,email:e.target.value})}/></div>
                  <div className="form-group"><label>Phone</label><input value={settings.phone} onChange={e=>updateSettings({...settings,phone:e.target.value})}/></div>
                </div>
                <div className="form-row" style={{marginTop:"1rem"}}>
                  <div className="form-group"><label>Address</label><input value={settings.address||""} onChange={e=>updateSettings({...settings,address:e.target.value})}/></div>
                  <div className="form-group"><label>Website</label><input value={settings.website||""} onChange={e=>updateSettings({...settings,website:e.target.value})}/></div>
                </div>
              </div>
              <div className="aform">
                <h3>Invoice Defaults</h3>
                <div className="form-row">
                  <div className="form-group"><label>Tax Rate (%)</label><input type="number" min="0" step="0.1" value={settings.taxRate||"0"} onChange={e=>updateSettings({...settings,taxRate:e.target.value})}/></div>
                  <div className="form-group"><label>Payment Due (days after invoice)</label><input type="number" min="1" value={settings.invoiceDueDays||"14"} onChange={e=>updateSettings({...settings,invoiceDueDays:e.target.value})}/></div>
                </div>
                <div className="form-group" style={{marginTop:"1rem"}}><label>Thank You Message</label><textarea rows={2} value={settings.thankYouMessage||""} onChange={e=>updateSettings({...settings,thankYouMessage:e.target.value})}/></div>
                <div className="form-group" style={{marginTop:"1rem"}}><label>Turnaround / Production Note</label><textarea rows={2} value={settings.turnaroundNote||""} onChange={e=>updateSettings({...settings,turnaroundNote:e.target.value})}/></div>
                <div className="form-group" style={{marginTop:"1rem"}}><label>Terms & Conditions</label><textarea rows={2} value={settings.termsConditions||""} onChange={e=>updateSettings({...settings,termsConditions:e.target.value})}/></div>
              </div>
              <div className="aform">
                <h3>Brand Colors</h3>
                <div className="color-row">
                  {[["colorBg","Background"],["colorGreen","Primary"],["colorBlue","Blue"],["colorPink","Pink"],["colorYellow","Yellow"],["colorInk","Text"]].map(([k,l])=>(
                    <div className="color-field" key={k}>
                      <input type="color" value={settings[k]} onChange={e=>updateSettings({...settings,[k]:e.target.value})}/>
                      <label>{l}</label>
                      <span style={{fontSize:".6rem",color:"var(--ink-muted)",fontFamily:"monospace"}}>{settings[k]}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="aform">
                <h3>Admin Access</h3>
                <p style={{fontSize:".85rem",color:"var(--ink-muted)",lineHeight:1.6}}>
                  Your admin code is stored securely in Netlify's environment variables
                  (<code style={{fontFamily:"monospace",background:"var(--bg)",padding:"2px 6px",borderRadius:4}}>ADMIN_ACCESS_CODE</code>) —
                  it's never visible on the page. To change it, update that value in Netlify
                  under Site configuration &gt; Environment variables.
                </p>
              </div>
            </>}

            {/* HOMEPAGE */}
            {adminTab==="hero"&&<>
              <div className="admin-header"><h2>Homepage</h2><p>Edit the hero section text and buttons.</p></div>
              <div className="aform">
                <h3>Hero Section</h3>
                <div className="form-group"><label>Eyebrow</label><input value={hero.eyebrow} onChange={e=>updateHero({...hero,eyebrow:e.target.value})}/></div>
                <div className="form-group" style={{marginTop:"1rem"}}>
                  <label>Headline — wrap a word in *asterisks* to make it italic & green</label>
                  <input value={hero.headline} onChange={e=>updateHero({...hero,headline:e.target.value})}/>
                  <span style={{fontSize:".72rem",color:"var(--ink-muted)"}}>Preview: <em style={{color:"var(--green)"}}>{renderHL(hero.headline)}</em></span>
                </div>
                <div className="form-group" style={{marginTop:"1rem"}}><label>Subheadline</label><textarea value={hero.subheadline} onChange={e=>updateHero({...hero,subheadline:e.target.value})} rows={2}/></div>
                <div className="form-row" style={{marginTop:"1rem"}}>
                  <div className="form-group"><label>Primary Button</label><input value={hero.cta1} onChange={e=>updateHero({...hero,cta1:e.target.value})}/></div>
                  <div className="form-group"><label>Secondary Button</label><input value={hero.cta2} onChange={e=>updateHero({...hero,cta2:e.target.value})}/></div>
                </div>
              </div>
            </>}

            {/* ABOUT */}
            {adminTab==="about"&&<>
              <div className="admin-header"><h2>About Page</h2></div>
              <div className="aform">
                <h3>Content</h3>
                <div className="form-row">
                  <div className="form-group"><label>Eyebrow</label><input value={about.eyebrow} onChange={e=>updateAbout({...about,eyebrow:e.target.value})}/></div>
                  <div className="form-group"><label>Headline</label><input value={about.headline} onChange={e=>updateAbout({...about,headline:e.target.value})}/></div>
                </div>
                <div className="form-group" style={{marginTop:"1rem"}}><label>Body 1</label><textarea rows={3} value={about.body1} onChange={e=>updateAbout({...about,body1:e.target.value})}/></div>
                <div className="form-group" style={{marginTop:"1rem"}}><label>Body 2</label><textarea rows={3} value={about.body2} onChange={e=>updateAbout({...about,body2:e.target.value})}/></div>
                <div className="form-group" style={{marginTop:"1rem"}}><label>CTA Button</label><input value={about.cta} onChange={e=>updateAbout({...about,cta:e.target.value})}/></div>
              </div>
              <div className="aform">
                <h3>Stats</h3>
                <div className="form-row-3">
                  {[1,2,3].map(n=>(
                    <div key={n}>
                      <div className="form-group"><label>Stat {n} Number</label><input value={about[`stat${n}num`]} onChange={e=>updateAbout({...about,[`stat${n}num`]:e.target.value})}/></div>
                      <div className="form-group" style={{marginTop:".75rem"}}><label>Stat {n} Label</label><input value={about[`stat${n}label`]} onChange={e=>updateAbout({...about,[`stat${n}label`]:e.target.value})}/></div>
                    </div>
                  ))}
                </div>
              </div>
            </>}

            {/* GALLERY */}
            {adminTab==="gallery_admin"&&<>
              <div className="admin-header"><h2>Gallery</h2><p>Manage portfolio pieces on the Our Work page.</p></div>
              <button className="btn-primary" style={{marginBottom:"1.5rem"}} onClick={()=>toggleAdd("gallery")}>
                {showAdd.gallery?"Cancel":"+ Add Gallery Item"}
              </button>
              {showAdd.gallery&&(
                <div className="aform">
                  <h3>New Gallery Item</h3>
                  <div className="form-row">
                    <div className="form-group"><label>Title</label><input value={newGallery.title} onChange={e=>setNewGallery({...newGallery,title:e.target.value})} placeholder="Team Jerseys — Acme FC"/></div>
                    <div className="form-group"><label>Description</label><input value={newGallery.desc} onChange={e=>setNewGallery({...newGallery,desc:e.target.value})} placeholder="Crest embroidery, 40 pieces"/></div>
                  </div>
                  <div className="form-row" style={{marginTop:"1rem"}}>
                    <div className="form-group"><label>Short Label</label><input value={newGallery.label} onChange={e=>setNewGallery({...newGallery,label:e.target.value})} placeholder="Jerseys"/></div>
                    <div className="form-group"><label>Card Background Color</label>
                      <div style={{display:"flex",gap:".75rem",alignItems:"center"}}>
                        <input type="color" value={newGallery.bg} onChange={e=>setNewGallery({...newGallery,bg:e.target.value})} style={{width:44,height:44,borderRadius:8,border:"1px solid var(--border)",cursor:"pointer"}}/>
                        <input value={newGallery.bg} onChange={e=>setNewGallery({...newGallery,bg:e.target.value})}/>
                      </div>
                    </div>
                  </div>
                  <div className="form-group" style={{marginTop:"1rem"}}>
                    <label>Photo (optional)</label>
                    <label className="upload-area" style={{display:"block",cursor:"pointer"}}>
                      <input type="file" accept="image/*" style={{display:"none"}} onChange={e=>{if(e.target.files[0])resizeImage(e.target.files[0],img=>setNewGallery({...newGallery,image:img}));}}/>
                      {newGallery.image?<img src={newGallery.image} alt="" className="upload-preview"/>:<p style={{fontSize:".82rem",color:"var(--ink-muted)"}}>Click to upload a photo</p>}
                    </label>
                  </div>
                  <button className="btn-primary" style={{marginTop:"1.25rem"}} onClick={()=>{
                    if(!newGallery.title)return;
                    addListItem("gallery",newGallery,()=>setNewGallery({label:"",bg:"#c5e0f2",title:"",desc:"",image:""}));
                    toggleAdd("gallery");
                  }}>Add Item</button>
                </div>
              )}
              {gallery.map((g)=>(
                <div className="acard" key={g.id}>
                  <div className="acard-row">
                    <div style={{display:"flex",alignItems:"center",gap:"1rem",flex:1,flexWrap:"wrap"}}>
                      <div style={{width:44,height:44,borderRadius:10,background:g.bg,overflow:"hidden",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                        {g.image?<img src={g.image} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={{fontFamily:"'DM Serif Display',serif",fontSize:".72rem",color:"rgba(30,30,30,0.5)",textTransform:"uppercase"}}>{g.label||"—"}</span>}
                      </div>
                      <div style={{flex:1}}>
                        <div style={{fontWeight:500,fontSize:".95rem",color:"var(--ink)"}}>{g.title}</div>
                        <div style={{fontSize:".8rem",color:"var(--ink-muted)"}}>{g.desc}</div>
                      </div>
                    </div>
                    <div className="acard-actions">
                      <button className="btn-sm-danger" onClick={()=>removeListItem("gallery",g.id)}>Remove</button>
                    </div>
                  </div>
                </div>
              ))}
            </>}

            {/* THREADS */}
            {adminTab==="threads"&&<>
              <div className="admin-header"><h2>Thread Colors</h2></div>
              <button className="btn-primary" style={{marginBottom:"1.5rem"}} onClick={()=>toggleAdd("threads")}>{showAdd.threads?"Cancel":"+ Add Thread Color"}</button>
              {showAdd.threads&&(
                <div className="aform">
                  <h3>New Thread Color</h3>
                  <div className="form-row">
                    <div className="form-group"><label>Name</label><input value={newThread.name} onChange={e=>setNewThread({...newThread,name:e.target.value})} placeholder="Ivory"/></div>
                    <div className="form-group"><label>DMC Code</label><input value={newThread.code} onChange={e=>setNewThread({...newThread,code:e.target.value})} placeholder="DMC-712"/></div>
                  </div>
                  <div className="form-group" style={{marginTop:"1rem"}}><label>Color</label>
                    <div style={{display:"flex",gap:"1rem",alignItems:"center"}}>
                      <input type="color" value={newThread.hex} onChange={e=>setNewThread({...newThread,hex:e.target.value})} style={{width:48,height:48,borderRadius:10,border:"1px solid var(--border)",cursor:"pointer"}}/>
                      <input value={newThread.hex} onChange={e=>setNewThread({...newThread,hex:e.target.value})} style={{flex:1}}/>
                    </div>
                  </div>
                  <button className="btn-primary" style={{marginTop:"1.25rem"}} onClick={()=>{
                    if(!newThread.name||!newThread.code)return;
                    addListItem("threads",newThread,()=>setNewThread({name:"",code:"",hex:"#52805f"}));
                    toggleAdd("threads");
                  }}>Add Color</button>
                </div>
              )}
              {threads.map((t)=>(
                <div className="acard" key={t.id}>
                  <div className="acard-row">
                    <div style={{display:"flex",alignItems:"center",gap:"1rem",flex:1}}>
                      <input type="color" value={t.hex}
                        onChange={e=>updateListItemLocal("threads",t.id,{hex:e.target.value})}
                        onBlur={e=>persistListItem("threads",t.id,{...t,hex:e.target.value})}
                        style={{width:36,height:36,borderRadius:"50%",border:"3px solid white",boxShadow:"0 0 0 1px rgba(0,0,0,.1)",cursor:"pointer",padding:0}}/>
                      <div style={{flex:1}}>
                        <input value={t.name}
                          onChange={e=>updateListItemLocal("threads",t.id,{name:e.target.value})}
                          onBlur={e=>persistListItem("threads",t.id,{...t,name:e.target.value})}
                          style={{border:"none",background:"transparent",fontSize:".95rem",color:"var(--ink)",fontWeight:500,width:"100%",outline:"none",fontFamily:"'Jost',sans-serif"}}/>
                        <input value={t.code}
                          onChange={e=>updateListItemLocal("threads",t.id,{code:e.target.value})}
                          onBlur={e=>persistListItem("threads",t.id,{...t,code:e.target.value})}
                          style={{border:"none",background:"transparent",fontSize:".8rem",color:"var(--ink-muted)",width:"100%",outline:"none",fontFamily:"'Jost',sans-serif"}}/>
                      </div>
                    </div>
                    <button className="btn-sm-danger" onClick={()=>removeListItem("threads",t.id)}>Remove</button>
                  </div>
                </div>
              ))}
            </>}

            {/* FONTS */}
            {adminTab==="fonts"&&<>
              <div className="admin-header"><h2>Font Styles</h2><p>Individual lettering styles shown in the catalog.</p></div>
              <button className="btn-primary" style={{marginBottom:"1.5rem"}} onClick={()=>toggleAdd("fonts")}>{showAdd.fonts?"Cancel":"+ Add Font Style"}</button>
              {showAdd.fonts&&(
                <div className="aform">
                  <h3>New Font Style</h3>
                  <div className="form-row">
                    <div className="form-group"><label>Style Name</label><input value={newFont.name} onChange={e=>setNewFont({...newFont,name:e.target.value})} placeholder="Varsity Block"/></div>
                    <div className="form-group"><label>Description</label><input value={newFont.desc} onChange={e=>setNewFont({...newFont,desc:e.target.value})} placeholder="Athletic block lettering"/></div>
                  </div>
                  <div className="form-row" style={{marginTop:"1rem"}}>
                    <div className="form-group"><label>Sample Text</label><input value={newFont.sample} onChange={e=>setNewFont({...newFont,sample:e.target.value})} placeholder="Monogram"/></div>
                    <div className="form-group"><label>CSS Font Family</label><input value={newFont.cssFamily} onChange={e=>setNewFont({...newFont,cssFamily:e.target.value})} placeholder="Georgia, serif"/></div>
                  </div>
                  <button className="btn-primary" style={{marginTop:"1.25rem"}} onClick={()=>{
                    if(!newFont.name)return;
                    addListItem("fonts",newFont,()=>setNewFont({name:"",sample:"Monogram",cssFamily:"Georgia, serif",cssExtra:"",desc:""}));
                    toggleAdd("fonts");
                  }}>Add Font</button>
                </div>
              )}
              {fonts.map((f)=>(
                <div className="acard" key={f.id}>
                  <div className="acard-row">
                    <div style={{display:"flex",alignItems:"center",gap:"1.5rem",flex:1,flexWrap:"wrap"}}>
                      <div style={{fontSize:"1.75rem",fontFamily:f.cssFamily,minWidth:100,color:"var(--ink)"}}>{f.sample}</div>
                      <div style={{flex:1}}>
                        <input value={f.name}
                          onChange={e=>updateListItemLocal("fonts",f.id,{name:e.target.value})}
                          onBlur={e=>persistListItem("fonts",f.id,{...f,name:e.target.value})}
                          style={{border:"none",background:"transparent",fontSize:".95rem",color:"var(--ink)",fontWeight:500,width:"100%",outline:"none",fontFamily:"'Jost',sans-serif"}}/>
                        <input value={f.desc}
                          onChange={e=>updateListItemLocal("fonts",f.id,{desc:e.target.value})}
                          onBlur={e=>persistListItem("fonts",f.id,{...f,desc:e.target.value})}
                          style={{border:"none",background:"transparent",fontSize:".8rem",color:"var(--ink-muted)",width:"100%",outline:"none",fontFamily:"'Jost',sans-serif"}}/>
                      </div>
                    </div>
                    <button className="btn-sm-danger" onClick={()=>removeListItem("fonts",f.id)}>Remove</button>
                  </div>
                </div>
              ))}
            </>}

            {/* FONT PACKAGES */}
            {adminTab==="fontPackages_admin"&&<>
              <div className="admin-header"><h2>Font Packages</h2><p>Bundle multiple font options into a downloadable PDF or a Canva link customers can browse.</p></div>
              <button className="btn-primary" style={{marginBottom:"1.5rem"}} onClick={()=>toggleAdd("fontPackages")}>{showAdd.fontPackages?"Cancel":"+ Add Font Package"}</button>
              {showAdd.fontPackages&&(
                <div className="aform">
                  <h3>New Font Package</h3>
                  <div className="form-row">
                    <div className="form-group"><label>Package Name</label><input value={newFontPackage.name} onChange={e=>setNewFontPackage({...newFontPackage,name:e.target.value})} placeholder="Wedding Monogram Set"/></div>
                    <div className="form-group"><label>Link Label</label><input value={newFontPackage.resourceLabel} onChange={e=>setNewFontPackage({...newFontPackage,resourceLabel:e.target.value})} placeholder="View PDF / View on Canva"/></div>
                  </div>
                  <div className="form-group" style={{marginTop:"1rem"}}><label>Description</label><input value={newFontPackage.desc} onChange={e=>setNewFontPackage({...newFontPackage,desc:e.target.value})} placeholder="12 elegant script options for wedding orders"/></div>
                  <div className="form-group" style={{marginTop:"1rem"}}>
                    <label>PDF or Canva Link</label>
                    <input value={newFontPackage.resourceUrl} onChange={e=>setNewFontPackage({...newFontPackage,resourceUrl:e.target.value})} placeholder="https://www.canva.com/design/... or a link to your PDF"/>
                  </div>
                  <p style={{fontSize:".78rem",color:"var(--ink-muted)",marginTop:".5rem"}}>
                    Host your PDF somewhere like Google Drive or Dropbox and paste the shareable link here, or paste a Canva design/share link.
                  </p>
                  <button className="btn-primary" style={{marginTop:"1.25rem"}} onClick={()=>{
                    if(!newFontPackage.name||!newFontPackage.resourceUrl)return;
                    addListItem("fontPackages",newFontPackage,()=>setNewFontPackage({name:"",desc:"",resourceUrl:"",resourceLabel:"View PDF"}));
                    toggleAdd("fontPackages");
                  }}>Add Package</button>
                </div>
              )}
              {fontPackages.map((fp)=>(
                <div className="acard" key={fp.id}>
                  <div className="acard-row">
                    <div style={{flex:1}}>
                      <input value={fp.name}
                        onChange={e=>updateListItemLocal("fontPackages",fp.id,{name:e.target.value})}
                        onBlur={e=>persistListItem("fontPackages",fp.id,{...fp,name:e.target.value})}
                        style={{border:"none",background:"transparent",fontSize:".95rem",color:"var(--ink)",fontWeight:500,width:"100%",outline:"none",fontFamily:"'Jost',sans-serif"}}/>
                      <input value={fp.desc||""}
                        onChange={e=>updateListItemLocal("fontPackages",fp.id,{desc:e.target.value})}
                        onBlur={e=>persistListItem("fontPackages",fp.id,{...fp,desc:e.target.value})}
                        style={{border:"none",background:"transparent",fontSize:".8rem",color:"var(--ink-muted)",width:"100%",outline:"none",fontFamily:"'Jost',sans-serif",marginBottom:".3rem"}}/>
                      <input value={fp.resourceUrl||""}
                        onChange={e=>updateListItemLocal("fontPackages",fp.id,{resourceUrl:e.target.value})}
                        onBlur={e=>persistListItem("fontPackages",fp.id,{...fp,resourceUrl:e.target.value})}
                        style={{border:"none",background:"transparent",fontSize:".78rem",color:"var(--green)",width:"100%",outline:"none",fontFamily:"'Jost',sans-serif"}}/>
                    </div>
                    <button className="btn-sm-danger" onClick={()=>removeListItem("fontPackages",fp.id)}>Remove</button>
                  </div>
                </div>
              ))}
            </>}

            {/* DESIGNS */}
            {adminTab==="designs"&&<>
              <div className="admin-header"><h2>Design Files</h2></div>
              <button className="btn-primary" style={{marginBottom:"1.5rem"}} onClick={()=>toggleAdd("designs")}>{showAdd.designs?"Cancel":"+ Add Design"}</button>
              {showAdd.designs&&(
                <div className="aform">
                  <h3>New Design</h3>
                  <div className="form-row">
                    <div className="form-group"><label>Name</label><input value={newDesign.name} onChange={e=>setNewDesign({...newDesign,name:e.target.value})} placeholder="Floral Wreath"/></div>
                    <div className="form-group"><label>Category</label><input value={newDesign.category} onChange={e=>setNewDesign({...newDesign,category:e.target.value})} placeholder="Nature"/></div>
                  </div>
                  <div className="form-group" style={{marginTop:"1rem"}}><label>File Formats</label><input value={newDesign.files} onChange={e=>setNewDesign({...newDesign,files:e.target.value})} placeholder="DST, PES, JEF"/></div>
                  <button className="btn-primary" style={{marginTop:"1.25rem"}} onClick={()=>{
                    if(!newDesign.name)return;
                    addListItem("designs",newDesign,()=>setNewDesign({name:"",category:"",files:"DST, PES"}));
                    toggleAdd("designs");
                  }}>Add Design</button>
                </div>
              )}
              {designs.map((d)=>(
                <div className="acard" key={d.id}>
                  <div className="acard-row">
                    <div style={{display:"flex",alignItems:"center",gap:"1rem",flex:1}}>
                      <div style={{width:40,height:40,borderRadius:8,background:"rgba(82,128,95,.12)",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                        <span style={{fontFamily:"'DM Serif Display',serif",fontSize:".85rem",color:"var(--green)"}}>{(d.category||"—").slice(0,1)}</span>
                      </div>
                      <div style={{flex:1}}>
                        <input value={d.name}
                          onChange={e=>updateListItemLocal("designs",d.id,{name:e.target.value})}
                          onBlur={e=>persistListItem("designs",d.id,{...d,name:e.target.value})}
                          style={{border:"none",background:"transparent",fontSize:".95rem",color:"var(--ink)",fontWeight:500,width:"100%",outline:"none",fontFamily:"'Jost',sans-serif"}}/>
                        <div style={{display:"flex",gap:"1rem"}}>
                          <input value={d.category}
                            onChange={e=>updateListItemLocal("designs",d.id,{category:e.target.value})}
                            onBlur={e=>persistListItem("designs",d.id,{...d,category:e.target.value})}
                            style={{border:"none",background:"transparent",fontSize:".8rem",color:"var(--ink-muted)",outline:"none",fontFamily:"'Jost',sans-serif"}} placeholder="Category"/>
                          <input value={d.files}
                            onChange={e=>updateListItemLocal("designs",d.id,{files:e.target.value})}
                            onBlur={e=>persistListItem("designs",d.id,{...d,files:e.target.value})}
                            style={{border:"none",background:"transparent",fontSize:".8rem",color:"var(--green)",outline:"none",fontFamily:"'Jost',sans-serif",fontWeight:600}} placeholder="DST, PES"/>
                        </div>
                      </div>
                    </div>
                    <button className="btn-sm-danger" onClick={()=>removeListItem("designs",d.id)}>Remove</button>
                  </div>
                </div>
              ))}
            </>}

            {/* CLIENT PORTALS */}
            {adminTab==="clients"&&<>
              <div className="admin-header"><h2>Client Portals</h2><p>Each client gets a unique access code. Set a lock date to close ordering after a deadline. Add a Stripe Payment Link so clients can pay directly at checkout.</p></div>
              <button className="btn-primary" style={{marginBottom:"1.5rem"}} onClick={()=>toggleAdd("clients")}>{showAdd.clients?"Cancel":"+ Create Client Portal"}</button>
              {showAdd.clients&&(
                <div className="aform">
                  <h3>New Client Portal</h3>
                  <div className="form-group"><label>Business Name</label><input value={newClient.name} onChange={e=>setNewClient({name:e.target.value})} placeholder="Acme Corp"/></div>
                  <p style={{fontSize:".8rem",color:"var(--ink-muted)",marginTop:".75rem"}}>A unique access code will be auto-generated.</p>
                  <button className="btn-primary" style={{marginTop:"1.25rem"}} onClick={async()=>{
                    if(!newClient.name)return;
                    try{
                      const {portal}=await apiAdminPost(FN.adminPortals, adminCode, {action:"createPortal",name:newClient.name});
                      setNewClient({name:""});toggleAdd("clients");
                      await refreshAdminPortals();
                      showToast(`Portal created — Code: ${portal.code}`);
                    }catch{showToast("Could not create portal.");}
                  }}>Create Portal</button>
                </div>
              )}
              {adminPortals.map((portal)=>(
                <div className="acard" key={portal.code}>
                  <div className="acard-row">
                    <div className="acard-info" style={{flex:1}}>
                      <div style={{display:"flex",alignItems:"center",gap:".75rem",flexWrap:"wrap",marginBottom:".4rem"}}>
                        <span style={{fontWeight:600,fontSize:"1rem",color:"var(--ink)"}}>{portal.name}</span>
                        <span className="code-badge">{portal.code}</span>
                        {isLocked(portal)&&<span className="lock-badge">Closed</span>}
                      </div>
                      <p>{portal.products.length} product{portal.products.length!==1?"s":""}{portal.lockDate?` · Closes ${new Date(portal.lockDate).toLocaleDateString()}`:""}</p>
                    </div>
                    <div className="acard-actions">
                      <button className="btn-sm-ghost" onClick={()=>{
                        setEditingPortalKey(portal.code);
                        setEditingPortalData({name:portal.name,lockDate:portal.lockDate||"",stripeLink:portal.stripeLink||""});
                      }}>Edit</button>
                      <button className="btn-sm-ghost" onClick={()=>showToast(`Code: ${portal.code}`)}>Copy Code</button>
                      <button className="btn-sm-green" onClick={()=>{
                        setAdminTab("invoices");
                        setPortalInvoiceKey(portal.code);
                        setPortalInvoiceItems(portal.products.map(p=>({
                          name:p.title,placementName:"",
                          unitPrice:parseFloat(p.basePrice||0),qty:1,
                          bg:p.bg,label:p.label,
                        })));
                      }}>Invoice</button>
                      <button className="btn-sm-danger" onClick={async()=>{
                        try{
                          await apiAdminPost(FN.adminPortals, adminCode, {action:"deletePortal",code:portal.code});
                          await refreshAdminPortals();
                          showToast("Portal removed");
                        }catch{showToast("Could not remove portal.");}
                      }}>Remove</button>
                    </div>
                  </div>
                  {editingPortalKey===portal.code&&editingPortalData&&(
                    <div className="edit-form" style={{marginTop:"1rem"}}>
                      <h4>Edit Portal</h4>
                      <div className="form-row">
                        <div className="form-group"><label>Business Name</label><input value={editingPortalData.name} onChange={e=>setEditingPortalData({...editingPortalData,name:e.target.value})}/></div>
                        <div className="form-group"><label>Lock Date & Time (ordering closes after this)</label><input type="datetime-local" value={editingPortalData.lockDate} onChange={e=>setEditingPortalData({...editingPortalData,lockDate:e.target.value})}/></div>
                      </div>
                      <div className="form-group" style={{marginTop:"1rem"}}>
                        <label>Stripe Payment Link URL (clients are sent here at checkout)</label>
                        <input value={editingPortalData.stripeLink} onChange={e=>setEditingPortalData({...editingPortalData,stripeLink:e.target.value})} placeholder="https://buy.stripe.com/..."/>
                      </div>
                      <div style={{display:"flex",gap:".75rem",marginTop:"1.25rem"}}>
                        <button className="btn-primary" onClick={async()=>{
                          try{
                            await apiAdminPost(FN.adminPortals, adminCode, {action:"updatePortal",code:portal.code,fields:editingPortalData});
                            setEditingPortalKey(null);setEditingPortalData(null);
                            await refreshAdminPortals();
                            showToast("Portal updated");
                          }catch{showToast("Could not update portal.");}
                        }}>Save Changes</button>
                        <button className="btn-sm-ghost" onClick={()=>{setEditingPortalKey(null);setEditingPortalData(null);}}>Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </>}

            {/* PORTAL PRODUCTS */}
            {adminTab==="products"&&<>
              <div className="admin-header"><h2>Portal Products</h2><p>Add or edit products for each client portal. Clients can select size and placement at checkout.</p></div>
              <div className="aform">
                <h3>Add Product to Portal</h3>
                <div className="form-group"><label>Client Portal</label>
                  <select value={newProduct.portalKey} onChange={e=>setNewProduct({...newProduct,portalKey:e.target.value})}>
                    <option value="">— Select a client —</option>
                    {adminPortals.map((p)=><option key={p.code} value={p.code}>{p.name} ({p.code})</option>)}
                  </select>
                </div>
                <div className="form-row" style={{marginTop:"1rem"}}>
                  <div className="form-group"><label>Product Name</label><input value={newProduct.title} onChange={e=>setNewProduct({...newProduct,title:e.target.value})} placeholder="Home Jersey Embroidery"/></div>
                  <div className="form-group"><label>Brand</label><input value={newProduct.brand} onChange={e=>setNewProduct({...newProduct,brand:e.target.value})} placeholder="Nike, Gildan..."/></div>
                </div>
                <div className="form-row" style={{marginTop:"1rem"}}>
                  <div className="form-group"><label>Base Price ($)</label><input value={newProduct.basePrice} onChange={e=>setNewProduct({...newProduct,basePrice:e.target.value})} placeholder="8.50"/></div>
                  <div className="form-group"><label>Display Price</label><input value={newProduct.price} onChange={e=>setNewProduct({...newProduct,price:e.target.value})} placeholder="$8.50/ea"/></div>
                </div>
                <div className="form-group" style={{marginTop:"1rem"}}><label>Description</label><input value={newProduct.desc} onChange={e=>setNewProduct({...newProduct,desc:e.target.value})} placeholder="4&quot; crest, left chest"/></div>
                <div className="form-row" style={{marginTop:"1rem"}}>
                  <div className="form-group"><label>Short Label (on card)</label><input value={newProduct.label} onChange={e=>setNewProduct({...newProduct,label:e.target.value})} placeholder="Jersey"/></div>
                  <div className="form-group"><label>Card Color</label>
                    <div style={{display:"flex",gap:".75rem",alignItems:"center"}}>
                      <input type="color" value={newProduct.bg} onChange={e=>setNewProduct({...newProduct,bg:e.target.value})} style={{width:44,height:44,borderRadius:8,border:"1px solid var(--border)",cursor:"pointer"}}/>
                      <input value={newProduct.bg} onChange={e=>setNewProduct({...newProduct,bg:e.target.value})}/>
                    </div>
                  </div>
                </div>
                <div className="form-group" style={{marginTop:"1rem"}}>
                  <label>Product Photo (optional)</label>
                  <label className="upload-area" style={{display:"block",cursor:"pointer"}}>
                    <input type="file" accept="image/*" style={{display:"none"}} onChange={e=>{if(e.target.files[0])resizeImage(e.target.files[0],img=>setNewProduct({...newProduct,image:img}));}}/>
                    {newProduct.image?<img src={newProduct.image} alt="" className="upload-preview"/>:<p style={{fontSize:".82rem",color:"var(--ink-muted)"}}>Click to upload a product photo</p>}
                  </label>
                </div>

                {/* Placement builder */}
                <div style={{marginTop:"1rem",padding:"1.25rem",background:"var(--bg)",borderRadius:12,border:"1px solid var(--border)"}}>
                  <div style={{fontSize:".72rem",letterSpacing:".14em",textTransform:"uppercase",color:"var(--green)",fontWeight:600,marginBottom:"1rem"}}>Logo Placement Options</div>
                  {newProduct.placements.length>0&&(
                    <div style={{marginBottom:"1rem",display:"flex",flexDirection:"column",gap:".5rem"}}>
                      {newProduct.placements.map((pl,i)=>(
                        <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:".6rem .9rem",background:"var(--card-bg)",borderRadius:8,border:"1px solid var(--border)"}}>
                          <span style={{fontSize:".88rem",color:"var(--ink)"}}>{pl.name}</span>
                          <div style={{display:"flex",alignItems:"center",gap:"1rem"}}>
                            <span style={{fontSize:".82rem",color:"var(--green)",fontWeight:600}}>{parseFloat(pl.extraCost||0)>0?`+$${parseFloat(pl.extraCost).toFixed(2)}`:"No extra cost"}</span>
                            <button className="btn-sm-danger" style={{padding:".25rem .65rem",fontSize:".68rem"}} onClick={()=>setNewProduct({...newProduct,placements:newProduct.placements.filter((_,j)=>j!==i)})}>Remove</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{display:"grid",gridTemplateColumns:"1fr 140px auto",gap:".75rem",alignItems:"end"}}>
                    <div className="form-group" style={{margin:0}}><label>Placement Name</label><input value={newPlacement.name} onChange={e=>setNewPlacement({...newPlacement,name:e.target.value})} placeholder="Left Chest"/></div>
                    <div className="form-group" style={{margin:0}}><label>Extra Cost ($)</label><input type="number" min="0" step="0.25" value={newPlacement.extraCost} onChange={e=>setNewPlacement({...newPlacement,extraCost:e.target.value})} placeholder="0.00"/></div>
                    <button className="btn-sm-green" onClick={()=>{
                      if(!newPlacement.name)return;
                      setNewProduct({...newProduct,placements:[...newProduct.placements,{...newPlacement,extraCost:newPlacement.extraCost||"0"}]});
                      setNewPlacement({name:"",extraCost:""});
                    }}>+ Add</button>
                  </div>
                </div>

                {/* Size builder */}
                <div style={{marginTop:"1rem",padding:"1.25rem",background:"var(--bg)",borderRadius:12,border:"1px solid var(--border)"}}>
                  <div style={{fontSize:".72rem",letterSpacing:".14em",textTransform:"uppercase",color:"var(--green)",fontWeight:600,marginBottom:"1rem"}}>Size Pricing</div>
                  {newProduct.sizes.length>0&&(
                    <div style={{marginBottom:"1rem",display:"flex",flexDirection:"column",gap:".5rem"}}>
                      {newProduct.sizes.map((sz,i)=>(
                        <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:".6rem .9rem",background:"var(--card-bg)",borderRadius:8,border:"1px solid var(--border)"}}>
                          <span style={{fontSize:".88rem",color:"var(--ink)",fontWeight:500}}>{sz.name}</span>
                          <div style={{display:"flex",alignItems:"center",gap:"1rem"}}>
                            <span style={{fontSize:".82rem",color:"var(--green)",fontWeight:600}}>${parseFloat(sz.price||0).toFixed(2)}/ea</span>
                            <button className="btn-sm-danger" style={{padding:".25rem .65rem",fontSize:".68rem"}} onClick={()=>setNewProduct({...newProduct,sizes:newProduct.sizes.filter((_,j)=>j!==i)})}>Remove</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{display:"grid",gridTemplateColumns:"1fr 140px auto",gap:".75rem",alignItems:"end"}}>
                    <div className="form-group" style={{margin:0}}><label>Size</label><input value={newSize.name} onChange={e=>setNewSize({...newSize,name:e.target.value})} placeholder="S, M, L, XL..."/></div>
                    <div className="form-group" style={{margin:0}}><label>Price ($)</label><input type="number" min="0" step="0.25" value={newSize.price} onChange={e=>setNewSize({...newSize,price:e.target.value})} placeholder="8.50"/></div>
                    <button className="btn-sm-green" onClick={()=>{
                      if(!newSize.name||!newSize.price)return;
                      setNewProduct({...newProduct,sizes:[...newProduct.sizes,{...newSize}]});
                      setNewSize({name:"",price:""});
                    }}>+ Add</button>
                  </div>
                  <p style={{fontSize:".75rem",color:"var(--ink-muted)",marginTop:".75rem"}}>Size pricing is for your reference and admin records only.</p>
                </div>

                <button className="btn-primary" style={{marginTop:"1.25rem"}} onClick={async()=>{
                  if(!newProduct.portalKey||!newProduct.title)return;
                  const fields={
                    ...newProduct,
                    placements:newProduct.placements.length>0?newProduct.placements:[{name:"Standard",extraCost:"0"}],
                  };
                  try{
                    await apiAdminPost(FN.adminPortals, adminCode, {action:"createProduct",portalCode:newProduct.portalKey,fields});
                    setNewProduct({portalKey:newProduct.portalKey,label:"",bg:"#c5e0f2",brand:"",title:"",price:"",basePrice:"",desc:"",image:"",placements:[],sizes:[]});
                    setNewPlacement({name:"",extraCost:""});setNewSize({name:"",price:""});
                    await refreshAdminPortals();
                    showToast("Product added");
                  }catch{showToast("Could not add product.");}
                }}>Add Product</button>
              </div>

              {/* Existing products per portal */}
              {adminPortals.map((portal)=>(
                <div key={portal.code} style={{marginBottom:"2rem"}}>
                  <div style={{display:"flex",alignItems:"center",gap:".75rem",marginBottom:".75rem",padding:".75rem 1rem",background:"var(--card-bg)",border:"1px solid var(--border)",borderRadius:12}}>
                    <span className="code-badge">{portal.code}</span>
                    <span style={{fontFamily:"'DM Serif Display',serif",fontSize:"1rem",color:"var(--ink)"}}>{portal.name}</span>
                    <span style={{fontSize:".8rem",color:"var(--ink-muted)",marginLeft:"auto"}}>{portal.products.length} products</span>
                  </div>
                  {portal.products.length===0&&<p style={{fontSize:".85rem",color:"var(--ink-muted)",padding:"0 1rem .5rem"}}>No products yet.</p>}
                  {portal.products.map((p,pi)=>(
                    <div className="acard" key={p.id} style={{marginLeft:"1rem"}}>
                      <div className="acard-row">
                        <div style={{display:"flex",alignItems:"center",gap:"1rem",flex:1}}>
                          <div style={{width:44,height:44,borderRadius:8,background:p.bg,overflow:"hidden",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                            {p.image?<img src={p.image} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={{fontFamily:"'DM Serif Display',serif",fontSize:".68rem",color:"rgba(30,30,30,0.5)",textTransform:"uppercase"}}>{p.label||"—"}</span>}
                          </div>
                          <div style={{flex:1}}>
                            <div style={{fontWeight:500,fontSize:".9rem",color:"var(--ink)"}}>{p.title}</div>
                            {p.brand&&<div style={{fontSize:".75rem",color:"var(--ink-muted)"}}>{p.brand}</div>}
                            <div style={{fontSize:".8rem",color:"var(--green)",fontWeight:600}}>{p.price}</div>
                            <div style={{fontSize:".75rem",color:"var(--ink-muted)"}}>{(p.placements||[]).length} placements · {(p.sizes||[]).length} sizes</div>
                          </div>
                        </div>
                        <div className="acard-actions">
                          <button className="btn-sm-ghost" onClick={()=>{
                            setEditingProductKey(portal.code);setEditingProductIdx(pi);
                            setEditingProductData({...p});
                          }}>Edit</button>
                          <button className="btn-sm-danger" onClick={async()=>{
                            try{
                              await apiAdminPost(FN.adminPortals, adminCode, {action:"deleteProduct",id:p.id});
                              await refreshAdminPortals();
                              showToast("Product removed");
                            }catch{showToast("Could not remove product.");}
                          }}>Remove</button>
                        </div>
                      </div>
                      {editingProductKey===portal.code&&editingProductIdx===pi&&editingProductData&&(
                        <div className="edit-form" style={{marginTop:"1rem"}}>
                          <h4>Edit Product</h4>
                          <div className="form-row">
                            <div className="form-group"><label>Product Name</label><input value={editingProductData.title} onChange={e=>setEditingProductData({...editingProductData,title:e.target.value})}/></div>
                            <div className="form-group"><label>Brand</label><input value={editingProductData.brand||""} onChange={e=>setEditingProductData({...editingProductData,brand:e.target.value})}/></div>
                          </div>
                          <div className="form-row" style={{marginTop:"1rem"}}>
                            <div className="form-group"><label>Base Price ($)</label><input value={editingProductData.basePrice||""} onChange={e=>setEditingProductData({...editingProductData,basePrice:e.target.value})}/></div>
                            <div className="form-group"><label>Display Price</label><input value={editingProductData.price||""} onChange={e=>setEditingProductData({...editingProductData,price:e.target.value})}/></div>
                          </div>
                          <div className="form-group" style={{marginTop:"1rem"}}><label>Description</label><input value={editingProductData.desc||""} onChange={e=>setEditingProductData({...editingProductData,desc:e.target.value})}/></div>
                          <div className="form-group" style={{marginTop:"1rem"}}>
                            <label>Product Photo</label>
                            <label className="upload-area" style={{display:"block",cursor:"pointer"}}>
                              <input type="file" accept="image/*" style={{display:"none"}} onChange={e=>{if(e.target.files[0])resizeImage(e.target.files[0],img=>setEditingProductData({...editingProductData,image:img}));}}/>
                              {editingProductData.image?<img src={editingProductData.image} alt="" className="upload-preview"/>:<p style={{fontSize:".82rem",color:"var(--ink-muted)"}}>Click to upload / replace photo</p>}
                            </label>
                          </div>
                          <div style={{display:"flex",gap:".75rem",marginTop:"1.25rem"}}>
                            <button className="btn-primary" onClick={async()=>{
                              try{
                                await apiAdminPost(FN.adminPortals, adminCode, {action:"updateProduct",id:editingProductData.id,fields:editingProductData});
                                setEditingProductKey(null);setEditingProductIdx(null);setEditingProductData(null);
                                await refreshAdminPortals();
                                showToast("Product updated");
                              }catch{showToast("Could not update product.");}
                            }}>Save Changes</button>
                            <button className="btn-sm-ghost" onClick={()=>{setEditingProductKey(null);setEditingProductIdx(null);setEditingProductData(null);}}>Cancel</button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </>}

            {/* ── INVOICES ── */}
            {adminTab==="invoices"&&<>
              <div className="admin-header"><h2>Invoices</h2><p>Generate an invoice manually for any client, or quickly build one from an existing portal's products.</p></div>

              {/* ── OPTION 1: Quick invoice from portal ── */}
              <div className="aform" style={{marginBottom:"2rem"}}>
                <h3>Quick Invoice from Client Portal</h3>
                <p style={{fontSize:".85rem",color:"var(--ink-muted)",marginBottom:"1.25rem"}}>Select a client portal, set quantities for their products, and generate a PDF instantly.</p>
                <div className="form-group" style={{marginBottom:"1.25rem"}}>
                  <label>Select Client Portal</label>
                  <select value={portalInvoiceKey||""} onChange={e=>{
                    const key=e.target.value;
                    setPortalInvoiceKey(key);
                    const portal=adminPortals.find(p=>p.code===key);
                    if(key&&portal){
                      setPortalInvoiceItems(portal.products.map(p=>({
                        name:p.title,
                        placementName:"",
                        unitPrice:parseFloat(p.basePrice||0),
                        qty:1,
                        bg:p.bg,
                        label:p.label,
                      })));
                    } else {
                      setPortalInvoiceItems([]);
                    }
                  }}>
                    <option value="">— Select a portal —</option>
                    {adminPortals.map((p)=>(
                      <option key={p.code} value={p.code}>{p.name} ({p.code})</option>
                    ))}
                  </select>
                </div>

                {portalInvoiceKey&&adminPortals.find(p=>p.code===portalInvoiceKey)&&portalInvoiceItems.length>0&&(
                  <>
                    <div style={{marginBottom:"1.25rem"}}>
                      {portalInvoiceItems.map((item,i)=>(
                        <div key={i} style={{display:"grid",gridTemplateColumns:"1fr 90px 120px auto",gap:".75rem",alignItems:"center",padding:".75rem",background:"var(--bg)",borderRadius:10,marginBottom:".5rem"}}>
                          <div>
                            <div style={{fontWeight:500,fontSize:".88rem",color:"var(--ink)"}}>{item.name}</div>
                            <input value={item.placementName} onChange={e=>{const u=[...portalInvoiceItems];u[i]={...item,placementName:e.target.value};setPortalInvoiceItems(u);}}
                              placeholder="Placement (optional)"
                              style={{border:"none",background:"transparent",fontSize:".75rem",color:"var(--ink-muted)",width:"100%",outline:"none",fontFamily:"'Jost',sans-serif",marginTop:".2rem"}}/>
                          </div>
                          <div className="form-group" style={{margin:0}}>
                            <label style={{fontSize:".62rem"}}>Qty</label>
                            <input type="number" min="0" value={item.qty} onChange={e=>{const u=[...portalInvoiceItems];u[i]={...item,qty:parseInt(e.target.value)||0};setPortalInvoiceItems(u);}}
                              style={{padding:".5rem .65rem",border:"1.5px solid var(--border)",borderRadius:8,background:"var(--card-bg)",fontFamily:"'Jost',sans-serif",fontSize:".88rem",color:"var(--ink)",outline:"none"}}/>
                          </div>
                          <div className="form-group" style={{margin:0}}>
                            <label style={{fontSize:".62rem"}}>Unit Price ($)</label>
                            <input type="number" min="0" step="0.25" value={item.unitPrice} onChange={e=>{const u=[...portalInvoiceItems];u[i]={...item,unitPrice:parseFloat(e.target.value)||0};setPortalInvoiceItems(u);}}
                              style={{padding:".5rem .65rem",border:"1.5px solid var(--border)",borderRadius:8,background:"var(--card-bg)",fontFamily:"'Jost',sans-serif",fontSize:".88rem",color:"var(--ink)",outline:"none"}}/>
                          </div>
                          <div style={{fontSize:".82rem",fontWeight:700,color:"var(--green)",minWidth:60,textAlign:"right"}}>${(item.unitPrice*(item.qty||0)).toFixed(2)}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{background:"var(--bg)",borderRadius:10,padding:"1rem",marginBottom:"1.25rem",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <span style={{fontSize:".85rem",color:"var(--ink-soft)",fontWeight:500}}>Estimated Total (before tax)</span>
                      <span style={{fontWeight:700,fontSize:"1rem",color:"var(--green)"}}>${portalInvoiceItems.reduce((s,i)=>s+(i.unitPrice*(i.qty||0)),0).toFixed(2)}</span>
                    </div>
                    <button className="btn-primary" onClick={()=>{
                      const portal=adminPortals.find(p=>p.code===portalInvoiceKey);
                      const today=new Date();
                      const due=new Date(today);
                      due.setDate(due.getDate()+parseInt(settings.invoiceDueDays||14));
                      const fmt=d=>d.toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'});
                      const num=`S1104-${Date.now().toString().slice(-6)}`;
                      generateInvoicePDF({
                        settings,
                        portal,
                        portalCode:portalInvoiceKey,
                        checkoutForm:{name:portal.name,email:"",phone:"",notes:""},
                        cartItems:portalInvoiceItems.filter(i=>i.qty>0).map(i=>({...i,cartId:i.name})),
                        cartTotal:portalInvoiceItems.reduce((s,i)=>s+(i.unitPrice*(i.qty||0)),0),
                        invoiceNumber:num,
                        invoiceDate:fmt(today),
                        dueDate:fmt(due),
                      });
                    }}>Generate Portal Invoice (PDF)</button>
                  </>
                )}
              </div>

              {/* ── OPTION 2: Manual invoice builder ── */}
              <div className="aform">
                <h3>Manual Invoice Builder</h3>
                <p style={{fontSize:".85rem",color:"var(--ink-muted)",marginBottom:"1.25rem"}}>Build a custom invoice from scratch — useful for one-off jobs, non-portal clients, or sending before a client places their order.</p>

                <div style={{fontSize:".72rem",letterSpacing:".14em",textTransform:"uppercase",color:"var(--green)",fontWeight:600,marginBottom:".75rem",display:"flex",alignItems:"center",gap:".5rem"}}>
                  <span style={{display:"inline-block",width:16,height:1.5,background:"var(--green)"}}></span>Client Info
                </div>
                <div className="form-row">
                  <div className="form-group"><label>Business / Client Name</label><input value={manualInvoice.clientName} onChange={e=>setManualInvoice({...manualInvoice,clientName:e.target.value})} placeholder="Acme Corp"/></div>
                  <div className="form-group"><label>Contact Name</label><input value={manualInvoice.clientContact} onChange={e=>setManualInvoice({...manualInvoice,clientContact:e.target.value})} placeholder="Jane Smith"/></div>
                </div>
                <div className="form-row" style={{marginTop:"1rem"}}>
                  <div className="form-group"><label>Phone</label><input value={manualInvoice.clientPhone} onChange={e=>setManualInvoice({...manualInvoice,clientPhone:e.target.value})} placeholder="(515) 000-0000"/></div>
                  <div className="form-group"><label>Due Date</label><input type="date" value={manualInvoice.dueDate} onChange={e=>setManualInvoice({...manualInvoice,dueDate:e.target.value})}/></div>
                </div>

                <div style={{fontSize:".72rem",letterSpacing:".14em",textTransform:"uppercase",color:"var(--green)",fontWeight:600,margin:"1.5rem 0 .75rem",display:"flex",alignItems:"center",gap:".5rem"}}>
                  <span style={{display:"inline-block",width:16,height:1.5,background:"var(--green)"}}></span>Line Items
                </div>

                {manualInvoice.items.length>0&&(
                  <div style={{marginBottom:"1rem"}}>
                    {manualInvoice.items.map((item,i)=>(
                      <div key={i} style={{display:"grid",gridTemplateColumns:"1fr 80px 110px auto",gap:".75rem",alignItems:"center",padding:".75rem",background:"var(--bg)",borderRadius:10,marginBottom:".5rem"}}>
                        <div style={{fontWeight:500,fontSize:".88rem",color:"var(--ink)"}}>{item.name}</div>
                        <div style={{fontSize:".82rem",color:"var(--ink-muted)",textAlign:"center"}}>×{item.qty}</div>
                        <div style={{fontSize:".82rem",color:"var(--ink-muted)",textAlign:"right"}}>${parseFloat(item.unitPrice).toFixed(2)}/ea</div>
                        <div style={{display:"flex",alignItems:"center",gap:".5rem",justifyContent:"flex-end"}}>
                          <span style={{fontSize:".82rem",fontWeight:700,color:"var(--green)"}}>${(parseFloat(item.unitPrice)*(parseInt(item.qty)||1)).toFixed(2)}</span>
                          <button className="btn-sm-danger" style={{padding:".2rem .6rem",fontSize:".65rem"}} onClick={()=>setManualInvoice({...manualInvoice,items:manualInvoice.items.filter((_,j)=>j!==i)})}>✕</button>
                        </div>
                      </div>
                    ))}
                    <div style={{display:"flex",justifyContent:"flex-end",padding:".5rem .75rem",borderTop:"1px solid var(--border)",marginTop:".25rem"}}>
                      <span style={{fontSize:".85rem",fontWeight:700,color:"var(--green)"}}>
                        Subtotal: ${manualInvoice.items.reduce((s,i)=>s+(parseFloat(i.unitPrice)*(parseInt(i.qty)||1)),0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}

                <div style={{display:"grid",gridTemplateColumns:"1fr 80px 110px auto",gap:".75rem",alignItems:"end",padding:"1rem",background:"rgba(82,128,95,.05)",borderRadius:10,border:"1px dashed var(--green)"}}>
                  <div className="form-group" style={{margin:0}}><label>Item Name</label><input value={manualInvoiceItem.name} onChange={e=>setManualInvoiceItem({...manualInvoiceItem,name:e.target.value})} placeholder="Home Jersey Embroidery"/></div>
                  <div className="form-group" style={{margin:0}}><label>Qty</label><input type="number" min="1" value={manualInvoiceItem.qty} onChange={e=>setManualInvoiceItem({...manualInvoiceItem,qty:e.target.value})}/></div>
                  <div className="form-group" style={{margin:0}}><label>Unit Price ($)</label><input type="number" min="0" step="0.25" value={manualInvoiceItem.unitPrice} onChange={e=>setManualInvoiceItem({...manualInvoiceItem,unitPrice:e.target.value})} placeholder="8.50"/></div>
                  <button className="btn-sm-green" style={{marginBottom:"1px"}} onClick={()=>{
                    if(!manualInvoiceItem.name||!manualInvoiceItem.unitPrice)return;
                    setManualInvoice({...manualInvoice,items:[...manualInvoice.items,{...manualInvoiceItem}]});
                    setManualInvoiceItem({name:"",qty:"1",unitPrice:""});
                  }}>+ Add</button>
                </div>

                <div className="form-group" style={{marginTop:"1.25rem"}}>
                  <label>Notes (optional)</label>
                  <textarea rows={2} value={manualInvoice.notes} onChange={e=>setManualInvoice({...manualInvoice,notes:e.target.value})} placeholder="Any special instructions or order details..."/>
                </div>

                <div style={{display:"flex",gap:"1rem",marginTop:"1.5rem",alignItems:"center",flexWrap:"wrap"}}>
                  <button className="btn-primary" onClick={()=>{
                    if(!manualInvoice.clientName||manualInvoice.items.length===0){showToast("Please add a client name and at least one item.");return;}
                    const today=new Date();
                    const due=manualInvoice.dueDate?new Date(manualInvoice.dueDate):new Date(today);
                    if(!manualInvoice.dueDate)due.setDate(due.getDate()+parseInt(settings.invoiceDueDays||14));
                    const fmt=d=>d.toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'});
                    const num=`S1104-${Date.now().toString().slice(-6)}`;
                    generateInvoicePDF({
                      settings,
                      portal:{name:manualInvoice.clientName},
                      portalCode:"",
                      checkoutForm:{name:manualInvoice.clientContact||manualInvoice.clientName,email:"",phone:manualInvoice.clientPhone||"",notes:manualInvoice.notes},
                      cartItems:manualInvoice.items.map(i=>({
                        title:i.name,placementName:"",brand:"",label:"",image:"",bg:"#c5e0f2",
                        unitPrice:parseFloat(i.unitPrice)||0,qty:parseInt(i.qty)||1,cartId:i.name,
                      })),
                      cartTotal:manualInvoice.items.reduce((s,i)=>s+(parseFloat(i.unitPrice)*(parseInt(i.qty)||1)),0),
                      invoiceNumber:num,
                      invoiceDate:fmt(today),
                      dueDate:fmt(due),
                    });
                  }}>Generate Invoice (PDF)</button>
                  <button className="btn-sm-ghost" onClick={()=>{
                    setManualInvoice({portalKey:"",clientName:"",clientContact:"",clientPhone:"",dueDate:"",notes:"",items:[]});
                    setManualInvoiceItem({name:"",qty:"1",unitPrice:""});
                    showToast("Invoice cleared");
                  }}>Clear</button>
                </div>
              </div>
            </>}

          </div>
        </div>
      </div>
      {toast&&<div className="toast">{toast}</div>}
    </>
  );

  // ── Public site ───────────────────────────────────────────────────────────
  const handleClientUnlock=async()=>{
    const key=clientCode.trim().toUpperCase();
    try{
      const data=await apiGet(`${FN.portal}?code=${encodeURIComponent(key)}`);
      if(data.portal){
        setActiveClient(key);
        setActivePortalData(data);
        setClientError("");
      }else{
        setClientError("Invalid access code — please check with us if you need help.");
      }
    }catch{
      setClientError("Could not check that code — please try again.");
    }
  };

  const portalCartCount=activeClient?cartCount(activeClient):0;

  return(
    <>
      <style>{css}</style>
      <nav>
        <div className="nav-logo" onClick={()=>nav("home")}>
          <img src={LOGO_URL} alt={settings.businessName}/>
          <div><div className="nav-logo-text">{settings.businessName}</div><div className="nav-logo-sub">{settings.tagline}</div></div>
        </div>
        <ul className="nav-links">
          {[["home","Home"],["about","About"],["gallery","Our Work"],["catalog","Catalog"],["order","Order"],["preorder","Pre-Order"]].map(([p,l])=>(
            <li key={p}><a className={page===p?"active":""} onClick={()=>nav(p)}>{l}</a></li>
          ))}
          <li><a className={page==="clients"?"active":""} onClick={()=>nav("clients")}>Client Portal</a></li>
        </ul>
        <button className="nav-admin-btn" onClick={()=>nav("admin")}>Admin</button>
      </nav>

      <div className="page">

        {/* HOME */}
        {page==="home"&&<>
          <div className="hero">
            <div className="blob" style={{width:500,height:500,top:-80,right:-100,borderRadius:"60% 40% 50% 50%/40% 60% 40% 60%",opacity:.4,background:settings.colorYellow}}/>
            <div className="blob" style={{width:360,height:360,bottom:-60,left:-80,borderRadius:"50% 50% 60% 40%/60% 40% 60% 40%",opacity:.35,background:settings.colorPink}}/>
            <div className="blob" style={{width:260,height:260,top:"35%",left:"18%",borderRadius:"40% 60% 40% 60%/50% 50% 50% 50%",opacity:.2,background:settings.colorBlue}}/>
            <div className="hero-inner">
              <div>
                <p className="hero-eyebrow">{hero.eyebrow}</p>
                <h1>{renderHL(hero.headline)}</h1>
                <p className="hero-sub">{hero.subheadline}</p>
                <div className="hero-actions">
                  <button className="btn-primary" onClick={()=>nav("order")}>{hero.cta1}</button>
                  <button className="btn-outline" onClick={()=>nav("gallery")}>{hero.cta2}</button>
                </div>
              </div>
              <div style={{display:"flex",alignItems:"center",justifyContent:"center"}}>
                <img src={LOGO_URL} alt={settings.businessName} className="hero-logo-img"/>
              </div>
            </div>
          </div>
          <div className="section">
            <p className="section-label">What We Offer</p>
            <h2 className="section-title" style={{marginBottom:".75rem"}}>Embroidery for every occasion</h2>
            <div className="features-grid">
              {[["colorPink","C","Custom Orders","One-off personalized pieces for gifts, weddings, or special occasions."],
                ["colorBlue","B","Business Programs","Bulk uniforms, branded merch, and corporate gifts with dedicated portals."],
                ["colorYellow","D","Design Library","Browse hundreds of ready-to-use designs or bring your own file."],
                ["colorGreen","T","Thread Catalog","Over 200 thread colors — find the perfect match for your brand."],
              ].map(([colorKey,init,title,desc])=>(
                <div className="feature-card" key={title}>
                  <div className="feature-pill" style={{background:settings[colorKey]+"55"}}>
                    <span style={{fontFamily:"'DM Serif Display',serif",fontSize:".9rem",color:settings[colorKey],fontWeight:700}}>{init}</span>
                  </div>
                  <h3>{title}</h3><p>{desc}</p>
                </div>
              ))}
            </div>
          </div>
          <div style={{background:"white",padding:"5rem 0"}}>
            <div className="section" style={{textAlign:"center",paddingTop:0,paddingBottom:0}}>
              <p className="section-label" style={{justifyContent:"center"}}>Ready to start?</p>
              <h2 className="section-title" style={{marginBottom:"1.5rem"}}>Let's make something beautiful.</h2>
              <div style={{display:"flex",gap:"1rem",justifyContent:"center",flexWrap:"wrap"}}>
                <button className="btn-primary" onClick={()=>nav("order")}>Start Your Order</button>
                <button className="btn-outline" onClick={()=>nav("catalog")}>Browse Catalog</button>
              </div>
            </div>
          </div>
        </>}

        {/* ABOUT */}
        {page==="about"&&<div className="section">
          <div className="about-layout">
            <div style={{position:"relative",display:"flex",alignItems:"center",justifyContent:"center"}}>
              <div className="blob" style={{width:200,height:200,top:-30,left:-30,borderRadius:"60% 40% 70% 30%/50% 60% 40% 50%",background:settings.colorYellow,opacity:.6}}/>
              <div className="blob" style={{width:160,height:160,bottom:-20,right:-20,borderRadius:"40% 60% 30% 70%/60% 40% 60% 40%",background:settings.colorBlue,opacity:.6}}/>
              <img src={LOGO_URL} alt={settings.businessName} style={{width:"100%",maxWidth:420,borderRadius:20,position:"relative",zIndex:1}}/>
            </div>
            <div>
              <p className="section-label">{about.eyebrow}</p>
              <h2 className="section-title" style={{marginBottom:"1rem"}}>{about.headline}</h2>
              <p className="section-body" style={{marginBottom:"1.5rem"}}>{about.body1}</p>
              <div className="stats-row">
                {[[about.stat1num,about.stat1label],[about.stat2num,about.stat2label],[about.stat3num,about.stat3label]].map(([n,l])=>(
                  <div key={l}><span className="stat-num">{n}</span><span className="stat-label">{l}</span></div>
                ))}
              </div>
              <p className="section-body" style={{marginBottom:"2rem"}}>{about.body2}</p>
              <button className="btn-primary" onClick={()=>nav("order")}>{about.cta}</button>
            </div>
          </div>
        </div>}

        {/* GALLERY */}
        {page==="gallery"&&<div className="section">
          <p className="section-label">Portfolio</p>
          <h2 className="section-title" style={{marginBottom:".75rem"}}>Our Work</h2>
          <p className="section-body">A selection of recent projects across industries and item types.</p>
          <div className="gallery-grid">
            {gallery.map(item=>(
              <div className="gallery-card" key={item.id}>
                <div className="gallery-img" style={{background:item.bg}}>
                  {item.image?<img src={item.image} alt={item.title}/>:<span style={{fontFamily:"'DM Serif Display',serif",fontSize:"1rem",color:"rgba(30,30,30,0.45)",letterSpacing:".12em",textTransform:"uppercase"}}>{item.label}</span>}
                </div>
                <div className="gallery-info"><h4>{item.title}</h4><p>{item.desc}</p></div>
              </div>
            ))}
          </div>
          <div style={{marginTop:"3rem",textAlign:"center"}}>
            <button className="btn-primary" onClick={()=>nav("order")}>Get a Quote</button>
          </div>
        </div>}

        {/* CATALOG */}
        {page==="catalog"&&<div className="section">
          <p className="section-label">Resources</p>
          <h2 className="section-title" style={{marginBottom:".5rem"}}>Thread, Font & Design Catalog</h2>
          <p className="section-body" style={{marginBottom:"2.5rem"}}>Reference this when placing your order.</p>
          <div className="catalog-tabs">
            {[["threads","Threads"],["fonts","Fonts"],["fontPackages","Font Packages"],["designs","Designs"]].map(([t,l])=>(
              <button key={t} className={`catalog-tab${catalogTab===t?" active":""}`} onClick={()=>setCatalogTab(t)}>{l}</button>
            ))}
          </div>
          {catalogTab==="threads"&&<div className="thread-grid">
            {threads.map(t=>(
              <div className="thread-swatch" key={t.id} title={`${t.name} — ${t.code}`}>
                <div className="swatch-circle" style={{background:t.hex}}/>
                <span className="swatch-name">{t.name}</span>
                <span className="swatch-code">{t.code}</span>
              </div>
            ))}
          </div>}
          {catalogTab==="fonts"&&<div className="font-grid">
            {fonts.map(f=>(
              <div className="font-card" key={f.id}>
                <div className="font-sample" style={{fontFamily:f.cssFamily}}>{f.sample}</div>
                <div className="font-meta">Style</div>
                <div className="font-name">{f.name} — {f.desc}</div>
              </div>
            ))}
          </div>}
          {catalogTab==="fontPackages"&&<div className="package-grid">
            {fontPackages.length===0&&<p style={{color:"var(--ink-muted)"}}>No font packages available yet.</p>}
            {fontPackages.map(fp=>(
              <div className="package-card" key={fp.id}>
                <h4>{fp.name}</h4>
                <p>{fp.desc}</p>
                {fp.resourceUrl&&(
                  <a href={fp.resourceUrl} target="_blank" rel="noopener noreferrer">
                    <button className="btn-sm-green">{fp.resourceLabel||"View"}</button>
                  </a>
                )}
              </div>
            ))}
          </div>}
          {catalogTab==="designs"&&<div className="design-grid">
            {designs.map(d=>(
              <div className="design-card" key={d.id}>
                <div style={{width:48,height:48,borderRadius:12,background:"rgba(82,128,95,.12)",margin:"0 auto .65rem",display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <span style={{fontFamily:"'DM Serif Display',serif",fontSize:"1rem",color:"var(--green)"}}>{d.category.slice(0,1)}</span>
                </div>
                <h4 style={{fontSize:".88rem",color:"var(--ink)",marginBottom:".2rem",fontWeight:500}}>{d.name}</h4>
                <p style={{fontSize:".75rem",color:"var(--ink-muted)"}}>{d.category}</p>
                <div className="design-files">{d.files}</div>
              </div>
            ))}
          </div>}
        </div>}

        {/* ORDER */}
        {page==="order"&&<div className="section">
          <p className="section-label">Custom Orders</p>
          <h2 className="section-title" style={{marginBottom:".5rem"}}>Place an Order</h2>
          <p className="section-body" style={{marginBottom:"3rem"}}>Fill out the form and we'll send a Stripe invoice within 24 hours.</p>
          <div className="order-layout">
            <div className="order-form">
              {[["Full Name *","name","text","Jane Smith"],["Email *","email","email","jane@example.com"],["Phone","phone","tel","(555) 000-0000"]].map(([label,key,type,ph])=>(
                <div className="form-group" key={key}><label>{label}</label><input type={type} value={orderForm[key]} placeholder={ph} onChange={e=>setOrderForm({...orderForm,[key]:e.target.value})}/></div>
              ))}
              <div className="form-group"><label>Item Type</label>
                <select value={orderForm.type} onChange={e=>setOrderForm({...orderForm,type:e.target.value})}>
                  {["Hat/Cap","T-Shirt / Polo","Jacket","Tote Bag","Blanket","Towel","Other"].map(o=><option key={o}>{o}</option>)}
                </select>
              </div>
              <div className="form-group"><label>Quantity</label><input type="number" min="1" value={orderForm.qty} onChange={e=>setOrderForm({...orderForm,qty:e.target.value})}/></div>
              <div className="form-group"><label>Thread Color(s) — reference catalog</label><input value={orderForm.colors} placeholder="e.g. DMC-838 Bark" onChange={e=>setOrderForm({...orderForm,colors:e.target.value})}/></div>
              <div className="form-group"><label>Font Style — reference catalog</label>
                <select value={orderForm.font} onChange={e=>setOrderForm({...orderForm,font:e.target.value})}>
                  {fonts.map(f=><option key={f.id}>{f.name}</option>)}
                </select>
              </div>
              <div className="form-group"><label>Notes / Design Instructions</label><textarea value={orderForm.notes} placeholder="Describe your design, placement, sizing..." onChange={e=>setOrderForm({...orderForm,notes:e.target.value})}/></div>
              <button className="btn-primary" onClick={()=>{
                if(!orderForm.name||!orderForm.email){showToast("Please add your name and email.");return;}
                showToast("Order sent! We'll email a Stripe invoice within 24 hours.");
                setOrderForm({name:"",email:"",phone:"",type:"Hat/Cap",qty:"1",colors:"",font:fonts[0]?.name||"",notes:""});
              }}>Submit Order Request</button>
            </div>
            <div className="order-sidebar">
              <h3>How It Works</h3>
              {[["Submit your request","Fill out the form with your item and design preferences."],
                ["We review & quote","Within 24 hours, we'll send a Stripe payment link."],
                ["Pay securely","Cards, Apple Pay, and more accepted."],
                ["Production begins","Enters our queue (5–10 business days)."],
                ["Shipped or picked up","We'll notify you when it's ready."],
              ].map(([title,desc],i)=>(
                <div className="how-step" key={i}>
                  <div className="step-num">{i+1}</div>
                  <div><div className="step-title">{title}</div><div className="step-desc">{desc}</div></div>
                </div>
              ))}
              <div className="stripe-badge">Payments processed securely via Stripe</div>
            </div>
          </div>
        </div>}

        {/* PRE-ORDER */}
        {page==="preorder"&&<PreorderIntakeForm slug={preorderSlug} onChooseSlug={navToPreorderSlug}/>}

        {/* CLIENT PORTAL */}
        {page==="clients"&&<>
          {!activeClient||!activePortalData?(
            <div className="portal-lock">
              <div className="lock-blob"/>
              <h2>Client Portal</h2>
              <p>Reserved for our business partners. Enter your unique access code to view your personalized catalog and pricing.</p>
              <input className="code-input" maxLength={8} value={clientCode}
                onChange={e=>setClientCode(e.target.value.toUpperCase())}
                onKeyDown={e=>e.key==="Enter"&&handleClientUnlock()}
                placeholder="XXXXXXX"/>
              {clientError&&<p className="portal-error">{clientError}</p>}
              <button className="btn-primary" style={{width:"100%"}} onClick={handleClientUnlock}>Access Portal</button>
            </div>
          ):(
            <div>
              {/* Portal header */}
              <div className="client-header">
                <div>
                  <h2>{activePortalData.portal.name}</h2>
                  <p>{cartOpen?"Your cart":"Your personalized catalog — pricing shown is your contracted rate."}</p>
                </div>
                <div className="client-header-actions">
                  {!isLocked(activePortalData.portal)&&(
                    <button className="cart-btn" onClick={()=>{setCartOpen(!cartOpen);setCheckoutDone(false);}}>
                      {cartOpen?"Back to Products":"Cart"}
                      {portalCartCount>0&&<span className="cart-badge">{portalCartCount}</span>}
                    </button>
                  )}
                  <button className="btn-outline" style={{color:"white",borderColor:"rgba(255,255,255,.4)",padding:".45rem 1rem",fontSize:".75rem"}}
                    onClick={()=>{setActiveClient(null);setActivePortalData(null);setClientCode("");setCartOpen(false);setCheckoutDone(false);}}>
                    Exit Portal
                  </button>
                </div>
              </div>

              {/* Locked portal */}
              {isLocked(activePortalData.portal)?(
                <div className="locked-portal">
                  <div style={{width:80,height:80,borderRadius:"50%",background:"var(--linen,#EDE3D5)",margin:"0 auto 1.5rem",border:"2px solid var(--border)"}}/>
                  <h2>This portal is closed</h2>
                  <p style={{fontFamily:"'Crimson Pro',serif",fontSize:"1.1rem",color:"var(--ink-muted)",lineHeight:1.7,marginTop:".75rem"}}>
                    The ordering window for {activePortalData.portal.name} has passed.
                    Please contact us if you need to make changes to an existing order.
                  </p>
                  <p style={{fontSize:".8rem",color:"var(--ink-muted)",marginTop:"1rem"}}>Closed: {new Date(activePortalData.portal.lockDate).toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</p>
                </div>
              ):cartOpen?(
                /* CART & CHECKOUT */
                <div className="cart-page">
                  {checkoutDone?(
                    <div className="checkout-done">
                      <div style={{width:72,height:72,borderRadius:"50%",background:"#f0faf3",margin:"0 auto 1.5rem",display:"flex",alignItems:"center",justifyContent:"center",border:"2px solid var(--green)"}}>
                        <span style={{fontSize:"1.5rem",color:"var(--green)"}}>✓</span>
                      </div>
                      <h3>Order Submitted!</h3>
                      <p>Thank you, {checkoutForm.name}. Your order has been received. {activePortalData.portal?.stripeLink?"Click below to complete payment via Stripe, or we'll":"We'll"} send a payment link to {checkoutForm.email} shortly.</p>
                      <div style={{display:"flex",gap:"1rem",justifyContent:"center",flexWrap:"wrap",marginTop:"1.5rem",marginBottom:"1rem"}}>
                        <button className="btn-primary" onClick={()=>{
                          const today=new Date();
                          const due=new Date(today);
                          due.setDate(due.getDate()+parseInt(settings.invoiceDueDays||14));
                          const fmt=d=>d.toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'});
                          generateInvoicePDF({
                            settings,
                            portal:activePortalData.portal,
                            portalCode:activeClient,
                            checkoutForm,
                            cartItems:cartItems(activeClient),
                            cartTotal:cartTotal(activeClient),
                            invoiceNumber,
                            invoiceDate:fmt(today),
                            dueDate:fmt(due),
                          });
                        }}>Download Invoice (PDF)</button>
                        {activePortalData.portal?.stripeLink&&(
                          <a href={activePortalData.portal.stripeLink} target="_blank" rel="noopener noreferrer">
                            <button className="btn-outline">Pay via Stripe</button>
                          </a>
                        )}
                      </div>
                      <button className="btn-sm-ghost" onClick={()=>{
                        setCart(prev=>({...prev,[activeClient]:[]}));
                        setCheckoutDone(false);setCartOpen(false);
                        setCheckoutForm({name:"",email:"",phone:"",notes:""});
                        setInvoiceNumber(`S1104-${Date.now().toString().slice(-6)}`);
                      }}>Back to Portal</button>
                    </div>
                  ):(
                    <>
                      <h2>Your Cart</h2>
                      {cartItems(activeClient).length===0?(
                        <div style={{textAlign:"center",padding:"3rem 1rem"}}>
                          <p style={{color:"var(--ink-muted)",marginBottom:"1.5rem",fontFamily:"'Crimson Pro',serif",fontSize:"1.1rem"}}>Your cart is empty. Add products from the catalog.</p>
                          <button className="btn-outline" onClick={()=>setCartOpen(false)}>Browse Products</button>
                        </div>
                      ):(
                        <div className="checkout-layout">
                          <div>
                            {cartItems(activeClient).map(item=>(
                              <div className="cart-item" key={item.cartId}>
                                {item.image?(
                                  <div className="cart-item-img"><img src={item.image} alt={item.title}/></div>
                                ):(
                                  <div className="cart-item-img-placeholder" style={{background:item.bg}}>
                                    <span style={{fontFamily:"'DM Serif Display',serif",fontSize:".72rem",color:"rgba(30,30,30,.45)",textTransform:"uppercase"}}>{item.label||""}</span>
                                  </div>
                                )}
                                <div className="cart-item-info">
                                  {item.brand&&<div style={{fontSize:".68rem",letterSpacing:".08em",textTransform:"uppercase",color:"var(--ink-muted)",fontWeight:500}}>{item.brand}</div>}
                                  <h4>{item.title}</h4>
                                  <p>{item.placementName&&item.placementName!=="Standard"?`Placement: ${item.placementName}`:""}</p>
                                  <div className="qty-control">
                                    <button className="qty-btn" onClick={()=>updateQty(activeClient,item.cartId,(item.qty||1)-1)}>−</button>
                                    <span className="qty-val">{item.qty||1}</span>
                                    <button className="qty-btn" onClick={()=>updateQty(activeClient,item.cartId,(item.qty||1)+1)}>+</button>
                                    <button className="btn-sm-danger" style={{marginLeft:".5rem",padding:".2rem .6rem",fontSize:".68rem"}} onClick={()=>removeFromCart(activeClient,item.cartId)}>Remove</button>
                                  </div>
                                </div>
                                <div className="cart-item-price">${(item.unitPrice*(item.qty||1)).toFixed(2)}</div>
                              </div>
                            ))}
                            <div className="cart-summary">
                              {cartItems(activeClient).map(item=>(
                                <div className="cart-total-row" key={item.cartId}>
                                  <span>{item.title} × {item.qty||1}</span>
                                  <span>${(item.unitPrice*(item.qty||1)).toFixed(2)}</span>
                                </div>
                              ))}
                              <div className="cart-total-row total">
                                <span>Total</span>
                                <span>${cartTotal(activeClient).toFixed(2)}</span>
                              </div>
                            </div>
                          </div>
                          <div style={{position:"sticky",top:84}}>
                            <div style={{background:"var(--card-bg)",border:"1px solid var(--border)",borderRadius:20,padding:"2rem"}}>
                              <h3 style={{fontFamily:"'DM Serif Display',serif",fontSize:"1.2rem",color:"var(--ink)",marginBottom:"1.25rem",paddingBottom:"1rem",borderBottom:"1px solid var(--border)"}}>Checkout</h3>
                              {[["Full Name *","name","text"],["Email *","email","email"],["Phone","phone","tel"]].map(([label,key,type])=>(
                                <div className="form-group" key={key} style={{marginBottom:"1rem"}}>
                                  <label>{label}</label>
                                  <input type={type} value={checkoutForm[key]} onChange={e=>setCheckoutForm({...checkoutForm,[key]:e.target.value})}/>
                                </div>
                              ))}
                              <div className="form-group" style={{marginBottom:"1.5rem"}}>
                                <label>Notes</label>
                                <textarea value={checkoutForm.notes} rows={2} onChange={e=>setCheckoutForm({...checkoutForm,notes:e.target.value})} placeholder="Any special instructions..."/>
                              </div>
                              <div style={{background:"var(--bg)",borderRadius:10,padding:"1rem",marginBottom:"1.25rem",fontSize:".82rem",color:"var(--ink-soft)"}}>
                                <div style={{display:"flex",justifyContent:"space-between",fontWeight:700,fontSize:".95rem",color:"var(--ink)"}}>
                                  <span>Order Total</span><span>${cartTotal(activeClient).toFixed(2)}</span>
                                </div>
                              </div>
                              <button className="btn-primary" style={{width:"100%"}} onClick={()=>{
                                if(!checkoutForm.name||!checkoutForm.email){showToast("Please add your name and email.");return;}
                                setCheckoutDone(true);
                              }}>Submit Order</button>
                              {activePortalData.portal?.stripeLink&&(
                                <p style={{fontSize:".72rem",color:"var(--ink-muted)",textAlign:"center",marginTop:".75rem"}}>You'll be directed to Stripe for payment after submitting.</p>
                              )}
                              <div className="stripe-badge" style={{marginTop:"1rem"}}>Payments processed securely via Stripe</div>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ):(
                /* PRODUCTS GRID */
                <div className="client-products">
                  {activePortalData.products.length===0
                    ?<p style={{color:"var(--ink-muted)",padding:"1rem"}}>No products yet — contact us to get set up.</p>
                    :activePortalData.products.map(p=>{
                      const placements=p.placements||[];
                      const hasPlacementChoice=placements.length>1;
                      const selPlacementIdx=selectedPlacements[p.id]??0;
                      const selPlacement=placements[selPlacementIdx]||placements[0];
                      const extraCost=parseFloat(selPlacement?.extraCost||0);
                      const basePrice=parseFloat(p.basePrice||0);
                      const totalPrice=basePrice>0?`$${(basePrice+extraCost).toFixed(2)}/ea`:p.price;
                      return(
                        <div className="client-product-card" key={p.id}>
                          <div className="product-img" style={{background:p.bg}}>
                            {p.image?<img src={p.image} alt={p.title}/>:<span style={{fontFamily:"'DM Serif Display',serif",fontSize:"1rem",color:"rgba(30,30,30,0.45)",letterSpacing:".1em",textTransform:"uppercase"}}>{p.label||p.title.split(" ")[0]}</span>}
                          </div>
                          <div className="product-info">
                            {p.brand&&<div style={{fontSize:".72rem",letterSpacing:".1em",textTransform:"uppercase",color:"var(--ink-muted)",marginBottom:".3rem",fontWeight:500}}>{p.brand}</div>}
                            <h4>{p.title}</h4>
                            <div className="product-price">{totalPrice}</div>
                            <p style={{marginBottom:hasPlacementChoice?".85rem":"0"}}>{p.desc}</p>
                            {hasPlacementChoice&&(
                              <div style={{marginBottom:".85rem"}}>
                                <label style={{fontSize:".68rem",letterSpacing:".1em",textTransform:"uppercase",color:"var(--ink-soft)",fontWeight:600,display:"block",marginBottom:".4rem"}}>Logo Placement</label>
                                <select value={selPlacementIdx} onChange={e=>setSelectedPlacements({...selectedPlacements,[p.id]:parseInt(e.target.value)})}
                                  style={{width:"100%",padding:".65rem .9rem",border:"1.5px solid var(--border)",borderRadius:8,background:"var(--card-bg)",fontFamily:"'Jost',sans-serif",fontSize:".88rem",color:"var(--ink)",outline:"none"}}>
                                  {placements.map((pl,i)=>(
                                    <option key={i} value={i}>{pl.name}{parseFloat(pl.extraCost||0)>0?` (+$${parseFloat(pl.extraCost).toFixed(2)})`:""}</option>
                                  ))}
                                </select>
                              </div>
                            )}
                            {!hasPlacementChoice&&placements.length===1&&placements[0].name!=="Standard"&&(
                              <p style={{fontSize:".75rem",color:"var(--ink-muted)",marginBottom:".85rem"}}>Placement: {placements[0].name}</p>
                            )}
                            <button className="btn-primary" style={{marginTop:".5rem",width:"100%",fontSize:".76rem"}} onClick={()=>addToCart(activeClient,{
                              productId:p.id,title:p.title,brand:p.brand,label:p.label,
                              image:p.image,bg:p.bg,
                              placementName:selPlacement?.name||"",
                              unitPrice:basePrice+extraCost||0,
                            })}>Add to Cart</button>
                          </div>
                        </div>
                      );
                    })
                  }
                </div>
              )}
            </div>
          )}
        </>}
      </div>

      {page!=="admin"&&(
        <footer>
          <div className="footer-logo">
            <img src={LOGO_URL} alt={settings.businessName}/>
            <div><div className="footer-logo-text">{settings.businessName}</div><div className="footer-logo-sub">{settings.tagline}</div></div>
          </div>
          <p>© 2026 {settings.businessName} · All rights reserved</p>
          <div className="footer-links">
            {[["home","Home"],["about","About"],["catalog","Catalog"],["order","Order"],["clients","Client Portal"]].map(([p,l])=>(
              <a key={p} onClick={()=>nav(p)}>{l}</a>
            ))}
          </div>
        </footer>
      )}
      {toast&&<div className="toast">{toast}</div>}
    </>
  );
}
