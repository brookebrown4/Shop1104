-- Shop 1104 — general storefront rebuild, schema migration 1
--
-- Run this once in the Supabase dashboard: Project -> SQL Editor -> New query
-- -> paste this whole file -> Run. It only adds tables/columns (nothing is
-- dropped or renamed), so it's safe to run against the live database even
-- though it's connected to live Stripe -- existing preorder-campaign data,
-- functions and admin tools are untouched.
--
-- What this does:
--   1. Extends `products` so one row can serve either the general storefront
--      (portal_code null) or a client portal (portal_code set), replacing
--      the old sale-scoped-only model.
--   2. Extends `client_portals` with an optional password.
--   3. Extends `orders` so a general-shop order doesn't need a sale_id and
--      can be tagged with a portal_code.
--   4. Adds new tables for categories, garment colors, embroidery
--      placements, reviews, custom-order requests, and contact messages.
--      (thread_colors and site_content already exist and are reused as-is.)

-- ── products: generalize beyond one-sale-only ──────────────────────────────
alter table products alter column sale_id drop not null;
alter table products add column if not exists category text;
alter table products add column if not exists portal_code text;
alter table products add column if not exists hidden boolean not null default false;
alter table products add column if not exists sold_out boolean not null default false;
alter table products add column if not exists threads jsonb not null default '[]'::jsonb;
alter table products add column if not exists placements jsonb not null default '[]'::jsonb;
alter table products add column if not exists addons jsonb not null default '[]'::jsonb;
-- `logos` (existing column, [{name, extraCost}]) is reused as the general
-- catalog's "choose a design" list -- no rename needed.

create index if not exists products_portal_code_idx on products (portal_code);
create index if not exists products_category_idx on products (category);

-- ── client_portals: optional password gate ─────────────────────────────────
alter table client_portals add column if not exists password text;
alter table client_portals add column if not exists password_enabled boolean not null default false;

-- ── orders: general-shop orders (no campaign, optional portal) ─────────────
alter table orders alter column sale_id drop not null;
alter table orders add column if not exists portal_code text;
alter table orders add column if not exists shipping_cents int not null default 0;
-- `garments` (existing jsonb array column) gains an optional `qty` per line
-- for the general cart -- no schema change needed, it's already jsonb.

-- ── categories ──────────────────────────────────────────────────────────────
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order int not null default 0,
  allowed_colors jsonb not null default '[]'::jsonb, -- [] = allow all garment colors
  created_at timestamptz not null default now()
);

-- ── garment_colors (global list; thread_colors already exists) ────────────
create table if not exists garment_colors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  hex text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- ── embroidery placements (global list) ────────────────────────────────────
create table if not exists placements (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- ── reviews (shown on homepage) ─────────────────────────────────────────────
create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  rating int not null check (rating between 1 and 5),
  quote text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- ── custom order requests (Custom Order page submissions) ──────────────────
create table if not exists custom_order_requests (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  phone text not null,
  address text not null,
  garment_type text not null,
  quantity int not null,
  need_by date,
  has_design boolean,
  attachment_urls jsonb not null default '[]'::jsonb,
  status text not null default 'new',
  created_at timestamptz not null default now()
);

-- ── contact messages (Contact page submissions) ─────────────────────────────
create table if not exists contact_messages (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  phone text not null,
  order_number text,
  message text not null,
  status text not null default 'new',
  created_at timestamptz not null default now()
);

-- site_content (already exists) will additionally hold, via upsert on `key`:
--   key = 'shippingSettings'  -> { base, perItem, freeThreshold }  (dollars)
--   key = 'catalogResource:threadColors' | ':fontOptions' | ':monogramStyles' | ':designs'
--                              -> { url, fileName }
-- No schema change needed for that -- it's the existing key/value table.
