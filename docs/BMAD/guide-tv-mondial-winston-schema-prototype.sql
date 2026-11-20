-- LMN24 Guide TV — Winston — prototype SQL v0.5, 2026-11-20
-- STUDY ONLY. NOT an approved production migration. DO NOT execute against LMN24.
-- Review alongside docs/BMAD/guide-tv-mondial-winston-schema-recette.md
-- Additive design prototype. Needs matching Prisma models, bootstrap alignment,
-- isolated PostgreSQL checks, schema inventory, backup and authorization before application.
BEGIN;

CREATE TABLE IF NOT EXISTS public.tv_country (
  country_id UUID PRIMARY KEY REFERENCES public.country(id) ON DELETE RESTRICT,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  reference_timezone VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tv_country_timezone_not_blank CHECK (length(trim(reference_timezone)) > 0)
);

CREATE TABLE IF NOT EXISTS public.tv_channel (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  logo_url TEXT,
  website_url TEXT,
  x_url TEXT,
  facebook_url TEXT,
  instagram_url TEXT,
  youtube_url TEXT,
  official_live_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tv_channel_name_nonempty CHECK (length(trim(name)) > 0)
);

CREATE TABLE IF NOT EXISTS public.tv_channel_country (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES public.tv_channel(id) ON DELETE RESTRICT,
  country_id UUID NOT NULL REFERENCES public.tv_country(country_id) ON DELETE RESTRICT,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  needs_review BOOLEAN NOT NULL DEFAULT TRUE,
  official_number INTEGER,
  manual_number INTEGER,
  assigned_number INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tv_channel_country_pair_unique UNIQUE(channel_id,country_id),
  CONSTRAINT tv_channel_country_number_positive CHECK (
    (official_number IS NULL OR official_number > 0)
    AND (manual_number IS NULL OR manual_number > 0)
    AND (assigned_number IS NULL OR assigned_number > 0)
  ),
  CONSTRAINT tv_channel_country_active_number CHECK (
    NOT is_active OR COALESCE(manual_number,official_number,assigned_number) IS NOT NULL
  )
);
-- Must enforce across all associations, not only active ones; potential
-- conflicting imported official numbers go to review before the write.
CREATE UNIQUE INDEX IF NOT EXISTS uq_tv_channel_country_effective_number
ON public.tv_channel_country(country_id, COALESCE(manual_number, official_number, assigned_number));

CREATE TABLE IF NOT EXISTS public.tv_channel_language (
  channel_id UUID NOT NULL REFERENCES public.tv_channel(id) ON DELETE CASCADE,
  language_code VARCHAR(16) NOT NULL,
  PRIMARY KEY(channel_id,language_code),
  CONSTRAINT tv_channel_language_format CHECK (language_code ~ '^[a-z]{2}(-[A-Za-z0-9]{2,8})*$')
);

CREATE TABLE IF NOT EXISTS public.tv_channel_variant (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES public.tv_channel(id) ON DELETE RESTRICT,
  code VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  timezone VARCHAR(100) NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT tv_variant_channel_code UNIQUE(channel_id,code),
  CONSTRAINT tv_variant_timezone_nonempty CHECK(length(trim(timezone)) > 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_tv_variant_single_default
ON public.tv_channel_variant(channel_id) WHERE is_default;

-- A variant can be offered in several countries, or only one.
CREATE TABLE IF NOT EXISTS public.tv_variant_country (
  variant_id UUID NOT NULL REFERENCES public.tv_channel_variant(id) ON DELETE CASCADE,
  channel_country_id UUID NOT NULL REFERENCES public.tv_channel_country(id) ON DELETE CASCADE,
  PRIMARY KEY(variant_id,channel_country_id)
);
-- Cross-table invariant 'same channel' must be checked in application and
-- in a future DEFERRABLE trigger prior to adoption of this prototype.

CREATE TABLE IF NOT EXISTS public.tv_source (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  source_url TEXT NOT NULL,
  format VARCHAR(16) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  rights_status VARCHAR(20) NOT NULL DEFAULT 'UNREVIEWED',
  rights_reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tv_source_format CHECK (format IN ('XMLTV','XMLTV_GZIP','JSON')),
  CONSTRAINT tv_source_rights CHECK (rights_status IN ('UNREVIEWED','APPROVED','REJECTED','EXPIRED'))
);
CREATE TABLE IF NOT EXISTS public.tv_source_country (
  source_id UUID NOT NULL REFERENCES public.tv_source(id) ON DELETE CASCADE,
  country_id UUID NOT NULL REFERENCES public.tv_country(country_id) ON DELETE RESTRICT,
  priority INTEGER NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY(source_id,country_id),
  CONSTRAINT tv_source_priority_positive CHECK(priority > 0)
);
CREATE INDEX IF NOT EXISTS idx_tv_source_country_priority
  ON public.tv_source_country(country_id,is_active,priority);

CREATE TABLE IF NOT EXISTS public.tv_channel_external_id (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES public.tv_source(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  channel_id UUID REFERENCES public.tv_channel(id) ON DELETE RESTRICT,
  variant_id UUID REFERENCES public.tv_channel_variant(id) ON DELETE RESTRICT,
  mapping_status VARCHAR(20) NOT NULL DEFAULT 'PENDING_REVIEW',
  CONSTRAINT tv_external_source_id UNIQUE(source_id,external_id),
  CONSTRAINT tv_external_status CHECK(mapping_status IN ('PENDING_REVIEW','VERIFIED','REJECTED')),
  CONSTRAINT tv_external_verified_target CHECK(mapping_status <> 'VERIFIED' OR channel_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS public.tv_channel_description (
  channel_id UUID NOT NULL REFERENCES public.tv_channel(id) ON DELETE CASCADE,
  language_code VARCHAR(16) NOT NULL,
  content TEXT NOT NULL,
  origin VARCHAR(16) NOT NULL,
  provider_id UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(channel_id,language_code),
  CONSTRAINT tv_description_origin CHECK(origin IN ('MANUAL','MACHINE','SOURCE')),
  CONSTRAINT tv_description_nonempty CHECK(length(trim(content)) > 0)
);

CREATE TABLE IF NOT EXISTS public.tv_programme (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  synopsis TEXT,
  category VARCHAR(120),
  image_url TEXT,
  season INTEGER,
  episode INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tv_programme_title_nonempty CHECK(length(trim(title)) > 0),
  CONSTRAINT tv_programme_season_positive CHECK(season IS NULL OR season >= 0),
  CONSTRAINT tv_programme_episode_positive CHECK(episode IS NULL OR episode >= 0)
);

CREATE TABLE IF NOT EXISTS public.tv_import_run (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger VARCHAR(12) NOT NULL,
  requested_days INTEGER NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'QUEUED',
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tv_import_days CHECK(requested_days BETWEEN 1 AND 7),
  CONSTRAINT tv_import_trigger CHECK(trigger IN ('MANUAL','AUTOMATIC')),
  CONSTRAINT tv_import_status CHECK(status IN ('QUEUED','RUNNING','SUCCESS','PARTIAL','ERROR','INTERRUPTED'))
);

CREATE TABLE IF NOT EXISTS public.tv_import_scope (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.tv_import_run(id) ON DELETE CASCADE,
  country_id UUID NOT NULL REFERENCES public.tv_country(country_id) ON DELETE RESTRICT,
  source_id UUID REFERENCES public.tv_source(id) ON DELETE SET NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'QUEUED',
  attempts INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  CONSTRAINT tv_scope_status CHECK(status IN ('QUEUED','RUNNING','SUCCESS','PARTIAL','ERROR','INTERRUPTED')),
  CONSTRAINT tv_scope_attempts CHECK(attempts >= 0)
);
CREATE INDEX IF NOT EXISTS idx_tv_scope_run_status ON public.tv_import_scope(run_id,status);

CREATE TABLE IF NOT EXISTS public.tv_import_event (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.tv_import_run(id) ON DELETE CASCADE,
  scope_id UUID REFERENCES public.tv_import_scope(id) ON DELETE SET NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  level VARCHAR(8) NOT NULL,
  event_type VARCHAR(64) NOT NULL,
  message TEXT NOT NULL,
  CONSTRAINT tv_import_event_level CHECK(level IN ('INFO','WARN','ERROR'))
);
CREATE INDEX IF NOT EXISTS idx_tv_import_event_time ON public.tv_import_event(occurred_at);

CREATE TABLE IF NOT EXISTS public.tv_schedule_revision (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id UUID NOT NULL REFERENCES public.tv_channel_variant(id) ON DELETE RESTRICT,
  local_date DATE NOT NULL,
  run_id UUID REFERENCES public.tv_import_run(id) ON DELETE SET NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'STAGING',
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tv_revision_status CHECK(status IN ('STAGING','VALIDATED','PUBLISHED','REJECTED')),
  CONSTRAINT tv_revision_published_timestamp CHECK(status <> 'PUBLISHED' OR published_at IS NOT NULL),
  CONSTRAINT tv_revision_tuple UNIQUE(id,variant_id,local_date)
);
CREATE INDEX IF NOT EXISTS idx_tv_revision_variant_date ON public.tv_schedule_revision(variant_id,local_date);

CREATE TABLE IF NOT EXISTS public.tv_airing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  revision_id UUID NOT NULL REFERENCES public.tv_schedule_revision(id) ON DELETE CASCADE,
  programme_id UUID NOT NULL REFERENCES public.tv_programme(id) ON DELETE RESTRICT,
  source_id UUID NOT NULL REFERENCES public.tv_source(id) ON DELETE RESTRICT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  fingerprint VARCHAR(128) NOT NULL,
  CONSTRAINT tv_airing_span CHECK(ends_at > starts_at),
  CONSTRAINT tv_airing_revision_fp UNIQUE(revision_id,fingerprint)
);
CREATE INDEX IF NOT EXISTS idx_tv_airing_revision_start ON public.tv_airing(revision_id,starts_at);

CREATE TABLE IF NOT EXISTS public.tv_schedule_current (
  variant_id UUID NOT NULL,
  local_date DATE NOT NULL,
  revision_id UUID NOT NULL UNIQUE,
  PRIMARY KEY(variant_id,local_date),
  CONSTRAINT tv_current_revision_scope_fk FOREIGN KEY (revision_id,variant_id,local_date)
  REFERENCES public.tv_schedule_revision(id,variant_id,local_date) ON DELETE RESTRICT
);
-- Current revisions must be PUBLISHED and checked under the existing parser
-- write-fencing lease in the SAME transaction; add dedicated trigger / write service.

CREATE TABLE IF NOT EXISTS public.tv_translation_provider (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_type VARCHAR(50) NOT NULL,
  endpoint TEXT NOT NULL,
  credential_reference TEXT,
  contact_email TEXT,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  is_selected BOOLEAN NOT NULL DEFAULT FALSE,
  free_approved_at TIMESTAMPTZ,
  rights_reviewed_at TIMESTAMPTZ,
  CONSTRAINT tv_provider_selected_approved CHECK(
    NOT is_selected OR (is_active AND free_approved_at IS NOT NULL AND rights_reviewed_at IS NOT NULL)
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_tv_one_selected_provider
ON public.tv_translation_provider(is_selected) WHERE is_selected;
ALTER TABLE public.tv_channel_description
  ADD CONSTRAINT tv_description_provider_fk
  FOREIGN KEY(provider_id) REFERENCES public.tv_translation_provider(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.tv_translation_attempt (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES public.tv_channel(id) ON DELETE CASCADE,
  provider_id UUID REFERENCES public.tv_translation_provider(id) ON DELETE SET NULL,
  target_language VARCHAR(16) NOT NULL,
  status VARCHAR(16) NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tv_translation_attempt_status CHECK(status IN ('SUCCESS','ERROR','UNSUPPORTED'))
);
CREATE INDEX IF NOT EXISTS idx_tv_translation_attempt_time ON public.tv_translation_attempt(occurred_at);

COMMIT;
