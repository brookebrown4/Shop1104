-- Shop 1104 — client portal visibility
--
-- Run this once in the Supabase dashboard: Project -> SQL Editor -> New query
-- -> paste this whole file -> Run. Only adds a column, nothing dropped.
--
-- Separates "closed" (past its lock_date -- customers see "This store
-- closed on <date>") from "hidden" (the access code stops working
-- entirely, same response as a code that never existed).

alter table client_portals add column if not exists hidden boolean not null default false;
