-- LMN24 - Migration 002
-- Ajout de la langue sur Article + historique FeedRun
-- À exécuter après 001_i18n_reference_cleanup.sql
--
-- Cette migration est conçue pour une base existante.
-- Si des articles existent déjà, leur langue est déduite uniquement lorsqu'un
-- couple (source_id, category_id) correspond à une seule langue dans les feeds.
-- Si certains articles restent sans langue, la migration s'arrête afin d'éviter
-- d'affecter une langue arbitraire.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. ARTICLE : ajout de language_iso_code2
-- ---------------------------------------------------------------------------

ALTER TABLE article
    ADD COLUMN IF NOT EXISTS language_iso_code2 CHAR(2);

-- Backfill prudent pour les éventuels articles déjà présents.
-- On ne renseigne la langue que si tous les feeds correspondant au couple
-- source/catégorie utilisent une seule et même langue.
WITH unambiguous_feed_language AS (
    SELECT
        source_id,
        category_id,
        MIN(language_iso_code2) AS language_iso_code2
    FROM feed
    GROUP BY source_id, category_id
    HAVING COUNT(DISTINCT language_iso_code2) = 1
)
UPDATE article AS a
SET language_iso_code2 = u.language_iso_code2
FROM unambiguous_feed_language AS u
WHERE a.language_iso_code2 IS NULL
  AND a.source_id = u.source_id
  AND a.category_id = u.category_id;

-- Ne pas poursuivre si des articles existants ne peuvent pas être rattachés
-- à une langue de manière fiable.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM article
        WHERE language_iso_code2 IS NULL
    ) THEN
        RAISE EXCEPTION
            'Migration interrompue : certains articles existants ne peuvent pas être associés automatiquement à une langue. Corrigez language_iso_code2 manuellement puis relancez la migration.';
    END IF;
END
$$;

-- La langue devient obligatoire.
ALTER TABLE article
    ALTER COLUMN language_iso_code2 SET NOT NULL;

-- Clé étrangère vers Language, créée uniquement si elle n'existe pas déjà.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'article_language_fk'
          AND conrelid = 'article'::regclass
    ) THEN
        ALTER TABLE article
            ADD CONSTRAINT article_language_fk
            FOREIGN KEY (language_iso_code2)
            REFERENCES language(iso_code2)
            ON UPDATE CASCADE
            ON DELETE RESTRICT;
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_article_language_iso_code2
    ON article(language_iso_code2);

CREATE INDEX IF NOT EXISTS idx_article_language_category_published_at
    ON article(language_iso_code2, category_id, published_at DESC);

-- ---------------------------------------------------------------------------
-- 2. FEED_RUN : historique d'exécution des feeds
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS feed_run (
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

CREATE INDEX IF NOT EXISTS idx_feed_run_feed_id
    ON feed_run(feed_id);

CREATE INDEX IF NOT EXISTS idx_feed_run_started_at
    ON feed_run(started_at DESC);

CREATE INDEX IF NOT EXISTS idx_feed_run_status
    ON feed_run(status);

CREATE INDEX IF NOT EXISTS idx_feed_run_feed_started_at
    ON feed_run(feed_id, started_at DESC);

COMMIT;
