-- LMN24 - Catégories officielles
-- Les libellés traduits se trouvent dans /messages/*.json.
-- Script réexécutable : il conserve les positions et styles déjà configurés.
-- Requiert schema.sql récent ou migration 006.
BEGIN;

-- Verrou commun avec l'API d'administration qui change l'ordre des catégories.
SELECT pg_advisory_xact_lock(241024, 1);

-- Les nouvelles catégories sont ajoutées à la suite, sans déplacer les autres.
WITH official (slug) AS (
    VALUES
        ('news'),
        ('international'),
        ('national'),
        ('sports'),
        ('faits-divers'),
        ('technology'),
        ('economy'),
        ('politics'),
        ('cinema'),
        ('culture'),
        ('health'),
        ('education'),
        ('society'),
        ('music'),
        ('television'),
        ('radio')
),
missing AS (
    SELECT official.slug
    FROM official
    LEFT JOIN category ON category.slug = official.slug
    WHERE category.id IS NULL
),
numbered AS (
    SELECT slug, ROW_NUMBER() OVER (ORDER BY slug)::INTEGER AS position
    FROM missing
),
base AS (
    SELECT COALESCE(MAX(display_order), 0) AS last_position FROM category
)
INSERT INTO category (slug, is_active, display_order)
SELECT numbered.slug, TRUE, base.last_position + numbered.position
FROM numbered CROSS JOIN base
ON CONFLICT (slug) DO NOTHING;

-- Réactive les catégories officielles, sans modifier leurs styles/positions.
UPDATE category SET is_active = TRUE, updated_at = NOW()
WHERE slug IN (
    'news', 'international', 'national', 'sports', 'faits-divers',
    'technology', 'economy', 'politics', 'cinema', 'culture', 'health',
    'education', 'society', 'music', 'television', 'radio'
) AND is_active IS DISTINCT FROM TRUE;

-- Désactive les catégories retirées du référentiel, sans perdre leur ordre.
UPDATE category SET is_active = FALSE, updated_at = NOW()
WHERE slug NOT IN (
    'news', 'international', 'national', 'sports', 'faits-divers',
    'technology', 'economy', 'politics', 'cinema', 'culture', 'health',
    'education', 'society', 'music', 'television', 'radio'
) AND is_active IS DISTINCT FROM FALSE;

COMMIT;
