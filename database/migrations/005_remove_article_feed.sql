-- LMN24 - Migration 005
-- Correction du modèle Article / Feed.
-- Un Article est rattaché directement à sa Source, sa Catégorie et sa Langue.
-- FeedRun reste rattaché au Feed pour l'historique d'exécution.
--
-- Cette migration est volontairement idempotente afin de fonctionner aussi
-- bien sur une base ayant appliqué la migration 004 que sur une base où
-- article.feed_id n'a jamais été créé.

BEGIN;

ALTER TABLE article
    DROP CONSTRAINT IF EXISTS article_feed_fk;

DROP INDEX IF EXISTS idx_article_feed_id;

ALTER TABLE article
    DROP COLUMN IF EXISTS feed_id;

COMMIT;
