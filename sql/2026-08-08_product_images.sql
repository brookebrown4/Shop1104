-- Shop 1104 — multiple product photos
--
-- Run this once in the Supabase dashboard: Project -> SQL Editor -> New query
-- -> paste this whole file -> Run. Only adds a column, nothing dropped
-- (the existing single image_data column stays as a fallback).

alter table products add column if not exists images jsonb not null default '[]'::jsonb;
