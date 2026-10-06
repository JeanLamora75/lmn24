-- LMN24 - Migration 002
-- Ajout de la langue sur Article + création de FeedRun
-- Base supposée vide de données métier (début de projet)

BEGIN;

-- ---------------------------------------------------------------------------
-- ARTICLE : ajout de la langue
-- ---------------------------------------------------------------------------

ALTER TABLE article
    ADD COLUMN language_iso_code2 CHAR(2) NOT NULL;

ALTER TABLE article
    ADD CONSTRAINT article_language_fk
    FOREIGN KEY (language_iso_code2)
    REFERENCES language(iso_code2)
    ON UPDATE CASCADE
    ON DELETE RESTRICT;

CREATE INDEX idx_article_language_iso_code2
    ON article(language_iso_code2);

CREATE INDEX idx_article_language_category_published_at
    ON article(language_iso_code2, category_id, published_at DESC);

-- ---------------------------------------------------------------------------
-- FEED_RUN : historique d'exécution des feeds
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

COMMIT;
