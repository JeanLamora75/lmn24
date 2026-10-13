-- LMN24 : paramètres administrables des tendances Hashtags
-- A exécuter dans PostgreSQL. Réexécutable sans écraser des valeurs existantes.
-- Crée les paramètres seulement ; n'active aucune fonctionnalité avant développement.
BEGIN;
INSERT INTO public.setting ("key", "value", "type", "scope", "scope_id", "description")
VALUES
('hashtagTrendMinMentions', '10', 'INTEGER', 'GLOBAL', NULL, 'Minimum de mentions actuelles pour apparaître dans les tendances'),
('hashtagTrendMinIncrease', '5', 'INTEGER', 'GLOBAL', NULL, 'Hausse minimale absolue de mentions pour apparaître dans les tendances'),
('hashtagTrendScoreFloor', '5', 'INTEGER', 'GLOBAL', NULL, 'Plancher du dénominateur de calcul du score des tendances')
ON CONFLICT ("key") WHERE "scope" = 'GLOBAL' DO NOTHING;
COMMIT;
SELECT "key", "value", "type", "scope" FROM public.setting
WHERE "scope"='GLOBAL' AND "key" IN
('hashtagTrendMinMentions','hashtagTrendMinIncrease','hashtagTrendScoreFloor')
ORDER BY "key";
