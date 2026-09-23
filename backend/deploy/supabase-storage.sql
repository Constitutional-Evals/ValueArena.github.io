-- Run in the Supabase SQL editor. The API alone accesses this private bucket.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('evaluation-results', 'evaluation-results', false, 50000000, array['application/gzip'])
on conflict (id) do nothing;
-- Do not add public read policies. API returns short-lived signed links to owners.
