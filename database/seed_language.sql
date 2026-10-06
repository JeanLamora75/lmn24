-- LMN24 - Langues supportées
BEGIN;

INSERT INTO language (iso_code2, is_active)
VALUES
    ('en', TRUE),
    ('fr', TRUE),
    ('de', TRUE),
    ('es', TRUE),
    ('pt', TRUE),
    ('it', TRUE),
    ('ru', TRUE)
ON CONFLICT (iso_code2)
DO UPDATE SET
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

COMMIT;
