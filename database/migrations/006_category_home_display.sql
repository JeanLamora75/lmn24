-- LMN24 - Migration 006 / SCRUM-25
-- Ajout non destructif de la présentation des catégories sur la page d'accueil.
-- A exécuter UNE FOIS sur les installations utilisant les migrations SQL
-- historiques database/migrations/001...005. Ne pas exécuter également
-- une migration Prisma équivalente sans baseline préalable (voir README).
--
-- Aucun article, feed ou lien de catégorie n'est modifié.
BEGIN;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'category_home_layout') THEN
        CREATE TYPE category_home_layout AS ENUM (
            'FEATURED', 'GRID', 'LIST', 'SPLIT', 'MOSAIC',
            'COMPACT', 'HEADLINES', 'CAROUSEL'
        );
    END IF;
END;
$$;

ALTER TABLE category
    ADD COLUMN IF NOT EXISTS display_order INTEGER,
    ADD COLUMN IF NOT EXISTS layout_type category_home_layout NOT NULL DEFAULT 'GRID',
    ADD COLUMN IF NOT EXISTS theme_color VARCHAR(7) NOT NULL DEFAULT '#2563EB';

-- Valeurs de démarrage pour les catégories déjà enregistrées ; ordre stable.
WITH ranked AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY slug ASC, id ASC)::INTEGER AS position
    FROM category
)
UPDATE category AS c
SET display_order = ranked.position
FROM ranked
WHERE c.id = ranked.id
  AND c.display_order IS NULL;

ALTER TABLE category ALTER COLUMN display_order SET NOT NULL;
ALTER TABLE category ALTER COLUMN layout_type SET DEFAULT 'GRID';
ALTER TABLE category ALTER COLUMN theme_color SET DEFAULT '#2563EB';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'category'::regclass
          AND conname = 'category_display_order_unique'
    ) THEN
        ALTER TABLE category
            ADD CONSTRAINT category_display_order_unique UNIQUE (display_order);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'category'::regclass
          AND conname = 'category_display_order_positive'
    ) THEN
        ALTER TABLE category
            ADD CONSTRAINT category_display_order_positive
            CHECK (display_order > 0);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'category'::regclass
          AND conname = 'category_theme_color_format'
    ) THEN
        ALTER TABLE category
            ADD CONSTRAINT category_theme_color_format
            CHECK (theme_color ~ '^#[0-9A-F]{6}$');
    END IF;
END;
$$;

COMMIT;
