-- LMN24 Guide TV - targeted read indexes for schedule lookup.
-- Additive, repeatable, no programme data updates.
-- The latest-revision anti-join uses the first index, while airing
-- date overlap can use the second index after revision filtering.
-- Run separately on production after inspection/backup; deploying code
-- alone is safe and does not require these indexes.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tv_revision_latest_visible
ON public.tv_schedule_revision (variant_id, local_date, created_at DESC, id DESC)
WHERE status IN ('STAGING','PUBLISHED');

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tv_airing_revision_interval
ON public.tv_airing (revision_id, starts_at, ends_at);
