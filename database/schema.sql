-- LMN24 - PostgreSQL schema
-- Generated from docs/DATA_MODEL.md
-- Target: PostgreSQL
--
-- Notes:
-- - UUIDs are generated with pgcrypto/gen_random_uuid().
-- - URL format validation is intentionally handled by the application layer.
-- - Article is linked directly to Source, as defined in DATA_MODEL.md.
-- - Setting.scope_id is polymorphic (CATEGORY or FEED), so it cannot use one standard FK.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- Common trigger for updated_at
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- COUNTRY
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS country (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    iso_code2 CHAR(2) NOT NULL,
    iso_code3 CHAR(3) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT country_iso_code2_unique UNIQUE (iso_code2),
    CONSTRAINT country_iso_code3_unique UNIQUE (iso_code3),
    CONSTRAINT country_slug_unique UNIQUE (slug),
    CONSTRAINT country_iso_code2_format CHECK (iso_code2 ~ '^[A-Z]{2}$'),
    CONSTRAINT country_iso_code3_format CHECK (iso_code3 ~ '^[A-Z]{3}$')
);

DROP TRIGGER IF EXISTS trg_country_updated_at ON country;
CREATE TRIGGER trg_country_updated_at
BEFORE UPDATE ON country
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- LANGUAGE
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS language (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(16) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT language_code_unique UNIQUE (code)
);

DROP TRIGGER IF EXISTS trg_language_updated_at ON language;
CREATE TRIGGER trg_language_updated_at
BEFORE UPDATE ON language
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- CATEGORY
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS category (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT category_slug_unique UNIQUE (slug)
);

DROP TRIGGER IF EXISTS trg_category_updated_at ON category;
CREATE TRIGGER trg_category_updated_at
BEFORE UPDATE ON category
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- SOURCE
-- A source is a newspaper/media outlet.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS source (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    website_url TEXT NOT NULL,
    logo_url TEXT,
    country_id UUID NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT source_slug_unique UNIQUE (slug),
    CONSTRAINT source_country_fk
        FOREIGN KEY (country_id)
        REFERENCES country(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_source_country_id
    ON source(country_id);

CREATE INDEX IF NOT EXISTS idx_source_is_active
    ON source(is_active);

DROP TRIGGER IF EXISTS trg_source_updated_at ON source;
CREATE TRIGGER trg_source_updated_at
BEFORE UPDATE ON source
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- FEED
-- A feed is an XML/RSS stream to be parsed.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS feed (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID NOT NULL,
    category_id UUID NOT NULL,
    language_id UUID NOT NULL,
    feed_url TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_fetched_at TIMESTAMPTZ,
    last_fetch_duration_ms INTEGER,
    last_fetch_status VARCHAR(32),
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT feed_url_unique UNIQUE (feed_url),
    CONSTRAINT feed_fetch_duration_non_negative
        CHECK (last_fetch_duration_ms IS NULL OR last_fetch_duration_ms >= 0),
    CONSTRAINT feed_source_fk
        FOREIGN KEY (source_id)
        REFERENCES source(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    CONSTRAINT feed_category_fk
        FOREIGN KEY (category_id)
        REFERENCES category(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    CONSTRAINT feed_language_fk
        FOREIGN KEY (language_id)
        REFERENCES language(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_feed_source_id
    ON feed(source_id);

CREATE INDEX IF NOT EXISTS idx_feed_category_id
    ON feed(category_id);

CREATE INDEX IF NOT EXISTS idx_feed_language_id
    ON feed(language_id);

CREATE INDEX IF NOT EXISTS idx_feed_is_active
    ON feed(is_active);

CREATE INDEX IF NOT EXISTS idx_feed_last_fetched_at
    ON feed(last_fetched_at);

DROP TRIGGER IF EXISTS trg_feed_updated_at ON feed;
CREATE TRIGGER trg_feed_updated_at
BEFORE UPDATE ON feed
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- ARTICLE
-- Article is intentionally linked directly to SOURCE, not FEED.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS article (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID NOT NULL,
    title TEXT NOT NULL,
    summary TEXT,
    image_url TEXT,
    article_url TEXT NOT NULL,
    published_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT article_url_unique UNIQUE (article_url),
    CONSTRAINT article_source_fk
        FOREIGN KEY (source_id)
        REFERENCES source(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_article_source_id
    ON article(source_id);

CREATE INDEX IF NOT EXISTS idx_article_published_at
    ON article(published_at DESC);

CREATE INDEX IF NOT EXISTS idx_article_source_published_at
    ON article(source_id, published_at DESC);

-- ---------------------------------------------------------------------------
-- SETTING
-- scope_id references a CATEGORY or FEED depending on scope.
-- Validation of that polymorphic reference is handled by the application.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS setting (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(255) NOT NULL,
    value TEXT NOT NULL,
    type VARCHAR(32) NOT NULL,
    scope VARCHAR(32) NOT NULL,
    scope_id UUID,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT setting_type_check
        CHECK (type IN ('INTEGER', 'BOOLEAN', 'STRING', 'DURATION')),
    CONSTRAINT setting_scope_check
        CHECK (scope IN ('GLOBAL', 'CATEGORY', 'FEED')),
    CONSTRAINT setting_scope_id_check
        CHECK (
            (scope = 'GLOBAL' AND scope_id IS NULL)
            OR
            (scope IN ('CATEGORY', 'FEED') AND scope_id IS NOT NULL)
        )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_setting_global_key
    ON setting(key)
    WHERE scope = 'GLOBAL';

CREATE UNIQUE INDEX IF NOT EXISTS uq_setting_scoped_key
    ON setting(key, scope, scope_id)
    WHERE scope IN ('CATEGORY', 'FEED');

CREATE INDEX IF NOT EXISTS idx_setting_scope
    ON setting(scope);

CREATE INDEX IF NOT EXISTS idx_setting_scope_id
    ON setting(scope_id);

DROP TRIGGER IF EXISTS trg_setting_updated_at ON setting;
CREATE TRIGGER trg_setting_updated_at
BEFORE UPDATE ON setting
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- USER
-- Physical table name is app_user to avoid ambiguity with PostgreSQL USER.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS app_user (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(320) NOT NULL,
    password_hash TEXT NOT NULL,
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    role VARCHAR(32) NOT NULL DEFAULT 'EDITOR',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT app_user_role_check
        CHECK (role IN ('ADMIN', 'EDITOR'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_app_user_email_lower
    ON app_user(LOWER(email));

CREATE INDEX IF NOT EXISTS idx_app_user_is_active
    ON app_user(is_active);

DROP TRIGGER IF EXISTS trg_app_user_updated_at ON app_user;
CREATE TRIGGER trg_app_user_updated_at
BEFORE UPDATE ON app_user
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

COMMIT;
