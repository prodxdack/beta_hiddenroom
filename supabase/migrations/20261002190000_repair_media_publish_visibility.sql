-- Ensure already-published Media posts are visible to the public feed.
-- Older CMS rows may have status = 'published' but no published_at value;
-- the public RLS policy intentionally excludes those rows.
update public.media_posts
set published_at = coalesce(published_at, updated_at, created_at, now())
where status = 'published'
  and published_at is null;
