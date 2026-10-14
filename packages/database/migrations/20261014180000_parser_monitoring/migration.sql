-- SCRUM-60 : suivi durable des lancements globaux et des événements parsers.
-- Migration additive, réexécutable pour un environnement local LMN24.
-- Sauvegarder PostgreSQL avant exécution. N'efface aucun historique existant.
BEGIN;
CREATE TABLE IF NOT EXISTS public.parser_batch_run (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parser_type VARCHAR(16) NOT NULL CHECK (parser_type IN ('INFOS','VIDEOS')),
  trigger VARCHAR(16) NOT NULL DEFAULT 'MANUAL'
    CHECK (trigger IN ('MANUAL','AUTOMATIC','UNKNOWN')),
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ(6),
  status VARCHAR(16) NOT NULL DEFAULT 'RUNNING'
    CHECK (status IN ('RUNNING','SUCCESS','ERROR','INTERRUPTED')),
  total_feeds INTEGER NOT NULL DEFAULT 0,
  processed_feeds INTEGER NOT NULL DEFAULT 0,
  successful_feeds INTEGER NOT NULL DEFAULT 0,
  failed_feeds INTEGER NOT NULL DEFAULT 0,
  items_found INTEGER NOT NULL DEFAULT 0,
  items_imported INTEGER NOT NULL DEFAULT 0,
  items_skipped INTEGER NOT NULL DEFAULT 0,
  last_heartbeat_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT parser_batch_counts_nonnegative CHECK (
    total_feeds >= 0 AND processed_feeds >= 0 AND successful_feeds >= 0
    AND failed_feeds >= 0 AND items_found >= 0 AND items_imported >= 0 AND items_skipped >= 0
  ),
  CONSTRAINT parser_batch_dates_valid CHECK (finished_at IS NULL OR finished_at >= started_at)
);

CREATE TABLE IF NOT EXISTS public.parser_run_event (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_run_id UUID NOT NULL REFERENCES public.parser_batch_run(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  level VARCHAR(8) NOT NULL CHECK (level IN ('INFO','WARN','ERROR')),
  event_type VARCHAR(40) NOT NULL,
  message VARCHAR(1024) NOT NULL,
  feed_id UUID,
  feed_video_id UUID
);

ALTER TABLE public.feed_run ADD COLUMN IF NOT EXISTS batch_run_id UUID;
ALTER TABLE public.feed_video_run ADD COLUMN IF NOT EXISTS batch_run_id UUID;
DO $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='feed_run_batch_run_id_fkey') THEN
    ALTER TABLE public.feed_run ADD CONSTRAINT feed_run_batch_run_id_fkey
      FOREIGN KEY (batch_run_id) REFERENCES public.parser_batch_run(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='feed_video_run_batch_run_id_fkey') THEN
    ALTER TABLE public.feed_video_run ADD CONSTRAINT feed_video_run_batch_run_id_fkey
      FOREIGN KEY (batch_run_id) REFERENCES public.parser_batch_run(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_parser_batch_type_started
  ON public.parser_batch_run(parser_type,started_at DESC);
CREATE INDEX IF NOT EXISTS idx_parser_batch_status_heartbeat
  ON public.parser_batch_run(status,last_heartbeat_at);
CREATE INDEX IF NOT EXISTS idx_parser_run_event_batch_time
  ON public.parser_run_event(batch_run_id,timestamp,id);
CREATE INDEX IF NOT EXISTS idx_feed_run_batch_id ON public.feed_run(batch_run_id);
CREATE INDEX IF NOT EXISTS idx_feed_video_run_batch_id ON public.feed_video_run(batch_run_id);
COMMIT;
