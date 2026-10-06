-- LMN24 - Catégories officielles
-- Les libellés traduits se trouvent dans /messages/*.json.
-- Le script est réexécutable.
BEGIN;

INSERT INTO category (slug, is_active)
VALUES
    ('news', TRUE),
    ('international', TRUE),
    ('national', TRUE),
    ('sports', TRUE),
    ('faits-divers', TRUE),
    ('technology', TRUE),
    ('economy', TRUE),
    ('politics', TRUE),
    ('cinema', TRUE),
    ('culture', TRUE),
    ('health', TRUE),
    ('education', TRUE),
    ('society', TRUE),
    ('music', TRUE),
    ('television', TRUE),
    ('radio', TRUE)
ON CONFLICT (slug)
DO UPDATE SET
    is_active = TRUE,
    updated_at = NOW();

-- Désactive les catégories qui ne font plus partie du référentiel officiel.
UPDATE category
SET is_active = FALSE,
    updated_at = NOW()
WHERE slug NOT IN ('news', 'international', 'national', 'sports', 'faits-divers', 'technology', 'economy', 'politics', 'cinema', 'culture', 'health', 'education', 'society', 'music', 'television', 'radio');

COMMIT;
