-- LMN24 - PostgreSQL bootstrap schema
-- Functional reference: docs/DATA_MODEL.md
-- Technical reference: packages/database/schema.prisma
-- Target: PostgreSQL
--
-- Purpose:
-- - Create a fresh LMN24 database schema from scratch.
-- - Existing databases must be evolved with migrations instead.
--
-- Notes:
-- - UUIDs are generated with pgcrypto/gen_random_uuid().
-- - PostgreSQL uses snake_case; Prisma/TypeScript uses camelCase.
-- - URL validation is handled by the application layer.
-- - Article is linked directly to Source, Category and Language, not Feed.
-- - Setting.scope_id is polymorphic (CATEGORY or FEED), so it has no standard FK.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- Common updated_at trigger
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

CREATE TABLE country (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

CREATE TRIGGER trg_country_updated_at
BEFORE UPDATE ON country
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- LANGUAGE
-- ---------------------------------------------------------------------------

CREATE TABLE language (
    iso_code2 CHAR(2) PRIMARY KEY,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT language_iso_code2_format CHECK (iso_code2 ~ '^[a-z]{2}$')
);

CREATE TRIGGER trg_language_updated_at
BEFORE UPDATE ON language
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- CATEGORY
-- ---------------------------------------------------------------------------

CREATE TABLE category (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT category_slug_unique UNIQUE (slug)
);

CREATE TRIGGER trg_category_updated_at
BEFORE UPDATE ON category
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- SOURCE
-- ---------------------------------------------------------------------------

CREATE TABLE source (
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

CREATE INDEX idx_source_country_id
    ON source(country_id);

CREATE INDEX idx_source_is_active
    ON source(is_active);

CREATE TRIGGER trg_source_updated_at
BEFORE UPDATE ON source
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- FEED
-- ---------------------------------------------------------------------------

CREATE TABLE feed (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID NOT NULL,
    category_id UUID NOT NULL,
    language_iso_code2 CHAR(2) NOT NULL,
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
        FOREIGN KEY (language_iso_code2)
        REFERENCES language(iso_code2)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

CREATE INDEX idx_feed_source_id
    ON feed(source_id);

CREATE INDEX idx_feed_category_id
    ON feed(category_id);

CREATE INDEX idx_feed_language_iso_code2
    ON feed(language_iso_code2);

CREATE INDEX idx_feed_is_active
    ON feed(is_active);

CREATE INDEX idx_feed_last_fetched_at
    ON feed(last_fetched_at);

CREATE TRIGGER trg_feed_updated_at
BEFORE UPDATE ON feed
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- ARTICLE
-- ---------------------------------------------------------------------------

CREATE TABLE article (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID NOT NULL,
    category_id UUID NOT NULL,
    language_iso_code2 CHAR(2) NOT NULL,
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
        ON DELETE RESTRICT,
    CONSTRAINT article_category_fk
        FOREIGN KEY (category_id)
        REFERENCES category(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    CONSTRAINT article_language_fk
        FOREIGN KEY (language_iso_code2)
        REFERENCES language(iso_code2)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

CREATE INDEX idx_article_source_id
    ON article(source_id);

CREATE INDEX idx_article_category_id
    ON article(category_id);

CREATE INDEX idx_article_language_iso_code2
    ON article(language_iso_code2);

CREATE INDEX idx_article_published_at
    ON article(published_at DESC);

CREATE INDEX idx_article_source_published_at
    ON article(source_id, published_at DESC);

CREATE INDEX idx_article_category_published_at
    ON article(category_id, published_at DESC);

CREATE INDEX idx_article_language_category_published_at
    ON article(language_iso_code2, category_id, published_at DESC);

-- ---------------------------------------------------------------------------
-- FEED_RUN
-- ---------------------------------------------------------------------------

CREATE TABLE feed_run (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feed_id UUID NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    duration_ms INTEGER,
    status VARCHAR(32) NOT NULL,
    items_found INTEGER NOT NULL DEFAULT 0,
    articles_imported INTEGER NOT NULL DEFAULT 0,
    articles_skipped INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT feed_run_feed_fk
        FOREIGN KEY (feed_id)
        REFERENCES feed(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    CONSTRAINT feed_run_duration_non_negative
        CHECK (duration_ms IS NULL OR duration_ms >= 0),
    CONSTRAINT feed_run_items_found_non_negative
        CHECK (items_found >= 0),
    CONSTRAINT feed_run_articles_imported_non_negative
        CHECK (articles_imported >= 0),
    CONSTRAINT feed_run_articles_skipped_non_negative
        CHECK (articles_skipped >= 0),
    CONSTRAINT feed_run_finished_after_started
        CHECK (finished_at IS NULL OR finished_at >= started_at)
);

CREATE INDEX idx_feed_run_feed_id
    ON feed_run(feed_id);

CREATE INDEX idx_feed_run_started_at
    ON feed_run(started_at DESC);

CREATE INDEX idx_feed_run_status
    ON feed_run(status);

CREATE INDEX idx_feed_run_feed_started_at
    ON feed_run(feed_id, started_at DESC);

-- ---------------------------------------------------------------------------
-- SETTING
-- ---------------------------------------------------------------------------

CREATE TABLE setting (
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

CREATE UNIQUE INDEX uq_setting_global_key
    ON setting(key)
    WHERE scope = 'GLOBAL';

CREATE UNIQUE INDEX uq_setting_scoped_key
    ON setting(key, scope, scope_id)
    WHERE scope IN ('CATEGORY', 'FEED');

CREATE INDEX idx_setting_scope
    ON setting(scope);

CREATE INDEX idx_setting_scope_id
    ON setting(scope_id);

CREATE TRIGGER trg_setting_updated_at
BEFORE UPDATE ON setting
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- APP_USER
-- Physical table name avoids ambiguity with PostgreSQL USER.
-- ---------------------------------------------------------------------------

CREATE TABLE app_user (
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

CREATE UNIQUE INDEX uq_app_user_email_lower
    ON app_user(LOWER(email));

CREATE INDEX idx_app_user_is_active
    ON app_user(is_active);

CREATE TRIGGER trg_app_user_updated_at
BEFORE UPDATE ON app_user
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- SESSION
-- ---------------------------------------------------------------------------

CREATE TABLE session (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    token_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT session_token_hash_unique UNIQUE (token_hash),
    CONSTRAINT session_user_fk
        FOREIGN KEY (user_id)
        REFERENCES app_user(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);

CREATE INDEX idx_session_user_id
    ON session(user_id);

CREATE INDEX idx_session_expires_at
    ON session(expires_at);

CREATE INDEX idx_session_revoked_at
    ON session(revoked_at);

CREATE TRIGGER trg_session_updated_at
BEFORE UPDATE ON session
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

COMMIT;
