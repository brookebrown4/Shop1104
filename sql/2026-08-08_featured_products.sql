-- Shop 1104 — featured products
--
-- Run this once in the Supabase dashboard: Project -> SQL Editor -> New query
-- -> paste this whole file -> Run. Only adds a column, nothing dropped.

alter table products add column if not exists featured boolean not null default false;
