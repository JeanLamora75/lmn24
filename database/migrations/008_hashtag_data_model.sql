-- LMN24 / SCRUM-48 : hashtag data model (additive, PostgreSQL)
--
-- For EXISTING databases already provisioned with database/schema.sql and the
-- relevant historic migrations. Run once with psql (ON_ERROR_STOP=1).
-- Do not run Prisma Migrate on a legacy database without a Prisma baseline.
-- No existing table is dropped, truncated or altered in this migration.
--
-- Articles and videos are intentionally NOT linked to hashtags by a join table.
-- Hourly counts will be populated by subsequent work (SCRUM-51/52).
--
-- BACKUP FIRST: pg_dump -Fc -f lmn24_before_hashtags.dump lmn24

BEGIN;

CREATE TABLE hashtag (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    image_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT hashtag_slug_unique UNIQUE (slug),
    CONSTRAINT hashtag_name_nonempty CHECK (btrim(name) <> ''),
    CONSTRAINT hashtag_slug_format CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

CREATE INDEX idx_hashtag_is_active ON hashtag(is_active);

CREATE TRIGGER trg_hashtag_updated_at
    BEFORE UPDATE ON hashtag
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE hashtag_alias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hashtag_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    normalized_name VARCHAR(255) NOT NULL,
    language_iso_code2 CHAR(2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT hashtag_alias_hashtag_id_fkey
        FOREIGN KEY (hashtag_id) REFERENCES hashtag(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT hashtag_alias_hashtag_normalized_unique
        UNIQUE (hashtag_id, normalized_name),
    CONSTRAINT hashtag_alias_name_nonempty CHECK (btrim(name) <> ''),
    CONSTRAINT hashtag_alias_normalized_nonempty
        CHECK (btrim(normalized_name) <> ''),
    CONSTRAINT hashtag_alias_language_iso_format
        CHECK (language_iso_code2 IS NULL
            OR language_iso_code2 ~ '^[a-z]{2}$')
);

-- Unique (hashtag_id, normalized_name) already supports lookup by hashtag_id.
-- A second index on hashtag_id would duplicate its leading index column.
-- normalized_name is computed by the *same* normalization function in the
-- backend/parser (NFKC, case fold, Latin accent and whitespace normalization).
-- SQL uniqueness protects against concurrent writes of an equal canonical key.
-- language_iso_code2 has no FK to language: an alias may use any language.

CREATE TABLE hashtag_hourly_count (
    hashtag_id UUID NOT NULL,
    hour_utc TIMESTAMPTZ NOT NULL,
    article_count INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT hashtag_hourly_count_pkey PRIMARY KEY (hashtag_id, hour_utc),
    CONSTRAINT hashtag_hourly_count_hashtag_id_fkey
        FOREIGN KEY (hashtag_id) REFERENCES hashtag(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT hashtag_hourly_count_article_count_nonnegative
        CHECK (article_count >= 0),
    CONSTRAINT hashtag_hourly_count_hour_aligned
        CHECK (date_trunc('hour', hour_utc AT TIME ZONE 'UTC')
            = hour_utc AT TIME ZONE 'UTC')
);

CREATE INDEX idx_hashtag_hourly_count_hour_utc
    ON hashtag_hourly_count(hour_utc);

CREATE TRIGGER trg_hashtag_hourly_count_updated_at
    BEFORE UPDATE ON hashtag_hourly_count
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;

-- Optional post-migration smoke inspection:
-- SELECT to_regclass('public.hashtag'),
--        to_regclass('public.hashtag_alias'),
--        to_regclass('public.hashtag_hourly_count');
