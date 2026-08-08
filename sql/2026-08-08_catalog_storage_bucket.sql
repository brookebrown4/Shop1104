-- Shop 1104 — catalog reference PDFs, real file storage
--
-- Run this once in the Supabase dashboard: Project -> SQL Editor -> New query
-- -> paste this whole file -> Run.
--
-- Why: catalog reference PDFs were being stored as base64 data embedded
-- directly in a database column, then handed to the browser as a data:
-- URL. That turned out to be unreliable for in-browser preview -- Chrome
-- blocks popup-opened data: URLs, and its PDF viewer renders embedded
-- data: URLs as a black box in an iframe. A real hosted file at a normal
-- https:// URL doesn't have either problem; browsers handle that natively.
--
-- This creates a public Storage bucket for these PDFs. "Public" here only
-- means anyone with the exact file URL can view/download that one file
-- (the same as any publicly linked PDF on the web) -- uploads still only
-- happen through the admin-only Netlify function using the service-role
-- key, which bypasses these policies entirely, so nothing about who can
-- upload changes.

insert into storage.buckets (id, name, public)
values ('catalog-resources', 'catalog-resources', true)
on conflict (id) do nothing;
