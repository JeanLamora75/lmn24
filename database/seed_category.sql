-- LMN24 - Catégories initiales
-- Les libellés traduits se trouvent dans /messages/*.json.
BEGIN;

INSERT INTO category (slug, is_active)
VALUES
    ('world', TRUE),
    ('politics', TRUE),
    ('economy', TRUE),
    ('technology', TRUE),
    ('sports', TRUE),
    ('culture', TRUE),
    ('health', TRUE)
ON CONFLICT (slug)
DO UPDATE SET
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

COMMIT;
