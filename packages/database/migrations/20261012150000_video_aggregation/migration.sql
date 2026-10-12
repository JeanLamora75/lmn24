-- SCRUM-37 — additive video extension; leaves existing tables untouched.
-- Generated alongside packages/database/schema.prisma; run only through the documented migration workflow.
CREATE TYPE "video_platform" AS ENUM ('YOUTUBE');

CREATE TABLE "feed_video" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "source_id" UUID NOT NULL,
  "category_id" UUID NOT NULL,
  "language_iso_code2" CHAR(2) NOT NULL,
  "platform" "video_platform" NOT NULL DEFAULT 'YOUTUBE',
  "channel_id" VARCHAR(255) NOT NULL,
  "feed_url" TEXT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "last_fetched_at" TIMESTAMPTZ(6),
  "last_fetch_duration_ms" INTEGER,
  "last_fetch_status" VARCHAR(32),
  "last_error" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "feed_video_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "feed_video_duration_nonnegative" CHECK ("last_fetch_duration_ms" IS NULL OR "last_fetch_duration_ms" >= 0)
);

CREATE TABLE "video" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "source_id" UUID NOT NULL,
  "feed_video_id" UUID,
  "category_id" UUID NOT NULL,
  "language_iso_code2" CHAR(2) NOT NULL,
  "platform" "video_platform" NOT NULL DEFAULT 'YOUTUBE',
  "platform_video_id" VARCHAR(255) NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "thumbnail_url" TEXT,
  "video_url" TEXT NOT NULL,
  "published_at" TIMESTAMPTZ(6) NOT NULL,
  "updated_on_platform_at" TIMESTAMPTZ(6),
  "is_published" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "video_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "feed_video_run" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "feed_video_id" UUID NOT NULL,
  "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finished_at" TIMESTAMPTZ(6),
  "duration_ms" INTEGER,
  "status" VARCHAR(32) NOT NULL,
  "items_found" INTEGER NOT NULL DEFAULT 0,
  "videos_imported" INTEGER NOT NULL DEFAULT 0,
  "videos_skipped" INTEGER NOT NULL DEFAULT 0,
  "error_message" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "feed_video_run_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "feed_video_run_counters_nonnegative" CHECK (
    ("duration_ms" IS NULL OR "duration_ms" >= 0) AND
    "items_found" >= 0 AND "videos_imported" >= 0 AND "videos_skipped" >= 0
  ),
  CONSTRAINT "feed_video_run_dates_valid" CHECK ("finished_at" IS NULL OR "finished_at" >= "started_at")
);

CREATE UNIQUE INDEX "feed_video_feed_url_unique" ON "feed_video"("feed_url");
CREATE UNIQUE INDEX "feed_video_platform_channel_unique" ON "feed_video"("platform", "channel_id");
CREATE INDEX "idx_feed_video_source_id" ON "feed_video"("source_id");
CREATE INDEX "idx_feed_video_category_id" ON "feed_video"("category_id");
CREATE INDEX "idx_feed_video_language_iso_code2" ON "feed_video"("language_iso_code2");
CREATE INDEX "idx_feed_video_is_active" ON "feed_video"("is_active");
CREATE INDEX "idx_feed_video_last_fetched_at" ON "feed_video"("last_fetched_at");

CREATE UNIQUE INDEX "video_platform_id_unique" ON "video"("platform", "platform_video_id");
CREATE INDEX "idx_video_source_id" ON "video"("source_id");
CREATE INDEX "idx_video_feed_video_id" ON "video"("feed_video_id");
CREATE INDEX "idx_video_category_id" ON "video"("category_id");
CREATE INDEX "idx_video_language_iso_code2" ON "video"("language_iso_code2");
CREATE INDEX "idx_video_published_at" ON "video"("published_at" DESC);
CREATE INDEX "idx_video_is_published" ON "video"("is_published");
CREATE INDEX "idx_video_language_category_published" ON "video"("language_iso_code2", "category_id", "published_at" DESC);

CREATE INDEX "idx_feed_video_run_feed_video_id" ON "feed_video_run"("feed_video_id");
CREATE INDEX "idx_feed_video_run_started_at" ON "feed_video_run"("started_at" DESC);
CREATE INDEX "idx_feed_video_run_status" ON "feed_video_run"("status");
CREATE INDEX "idx_feed_video_run_feed_started_at" ON "feed_video_run"("feed_video_id", "started_at" DESC);

ALTER TABLE "feed_video" ADD CONSTRAINT "feed_video_source_id_fkey"
  FOREIGN KEY ("source_id") REFERENCES "source"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "feed_video" ADD CONSTRAINT "feed_video_category_id_fkey"
  FOREIGN KEY ("category_id") REFERENCES "category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "feed_video" ADD CONSTRAINT "feed_video_language_iso_code2_fkey"
  FOREIGN KEY ("language_iso_code2") REFERENCES "language"("iso_code2") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "video" ADD CONSTRAINT "video_source_id_fkey"
  FOREIGN KEY ("source_id") REFERENCES "source"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "video" ADD CONSTRAINT "video_category_id_fkey"
  FOREIGN KEY ("category_id") REFERENCES "category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "video" ADD CONSTRAINT "video_language_iso_code2_fkey"
  FOREIGN KEY ("language_iso_code2") REFERENCES "language"("iso_code2") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "video" ADD CONSTRAINT "video_feed_video_id_fkey"
  FOREIGN KEY ("feed_video_id") REFERENCES "feed_video"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "feed_video_run" ADD CONSTRAINT "feed_video_run_feed_video_id_fkey"
  FOREIGN KEY ("feed_video_id") REFERENCES "feed_video"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
