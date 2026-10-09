-- LMN24 - Migration 004
-- Rattachement optionnel d'un Article à son Feed d'origine.
-- Les articles existants ne sont backfillés que si un seul feed correspond
-- exactement au triplet source/catégorie/langue, afin d'éviter toute
-- association ambiguë.

BEGIN;

ALTER TABLE article
    ADD COLUMN IF NOT EXISTS feed_id UUID;

WITH unambiguous_feed AS (
    SELECT
        source_id,
        category_id,
        language_iso_code2,
        MIN(id) AS feed_id
    FROM feed
    GROUP BY source_id, category_id, language_iso_code2
    HAVING COUNT(*) = 1
)
UPDATE article AS article_row
SET feed_id = unambiguous_feed.feed_id
FROM unambiguous_feed
WHERE article_row.feed_id IS NULL
  AND article_row.source_id = unambiguous_feed.source_id
  AND article_row.category_id = unambiguous_feed.category_id
  AND article_row.language_iso_code2 = unambiguous_feed.language_iso_code2;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'article_feed_fk'
    ) THEN
        ALTER TABLE article
            ADD CONSTRAINT article_feed_fk
            FOREIGN KEY (feed_id)
            REFERENCES feed(id)
            ON UPDATE CASCADE
            ON DELETE RESTRICT;
    END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_article_feed_id
    ON article(feed_id);

COMMIT;
