-- SCRUM-29 - Enrichissement de la fiche Source (migration additive).
-- Exécuter ce script sur chaque base PostgreSQL LMN24 déjà initialisée.
-- Ré-exécutable sans suppression de données. À exécuter avant le redémarrage du backend.
BEGIN;

ALTER TABLE source
  ADD COLUMN IF NOT EXISTS rss_page_url TEXT,
  ADD COLUMN IF NOT EXISTS facebook_url TEXT,
  ADD COLUMN IF NOT EXISTS x_url TEXT,
  ADD COLUMN IF NOT EXISTS instagram_url TEXT,
  ADD COLUMN IF NOT EXISTS youtube_url TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT;

COMMIT;
