-- LMN24 : paramètres indépendants de rétention (cible MVP)
-- À exécuter UNE FOIS (ou plusieurs : insertion idempotente) dans la base LMN24.
-- Ces paramètres n'exécutent aucune purge tant que les tâches applicatives ne
-- sont pas développées et activées.
-- Compatible avec la table public.setting et son index unique partiel
-- uq_setting_global_key (key WHERE scope = 'GLOBAL').

BEGIN;

INSERT INTO public.setting (
  "key", "value", "type", "scope", "scope_id", "description"
)
VALUES
  ('retentionArticlesDays', '60', 'INTEGER', 'GLOBAL', NULL,
   'Conservation des articles selon published_at, en jours'),
  ('retentionHoroscopesDays', '30', 'INTEGER', 'GLOBAL', NULL,
   'Conservation des horoscopes selon la date civile Europe/Paris, en jours'),
  ('retentionVideosDays', '60', 'INTEGER', 'GLOBAL', NULL,
   'Conservation des vidéos selon published_at, en jours'),
  ('retentionInfoParserRunsDays', '14', 'INTEGER', 'GLOBAL', NULL,
   'Conservation des historiques d’exécution du parser Infos (feed_run), en jours'),
  ('retentionVideoParserRunsDays', '14', 'INTEGER', 'GLOBAL', NULL,
   'Conservation des historiques d’exécution du parser Vidéos (feed_video_run), en jours'),
  ('retentionInfoParserLogsDays', '7', 'INTEGER', 'GLOBAL', NULL,
   'Conservation des fichiers de logs techniques du parser Infos, en jours'),
  ('retentionVideoParserLogsDays', '7', 'INTEGER', 'GLOBAL', NULL,
   'Conservation des fichiers de logs techniques du parser Vidéos, en jours'),
  ('retentionBackendLogsDays', '7', 'INTEGER', 'GLOBAL', NULL,
   'Conservation des fichiers de logs techniques du backend, en jours'),
  ('retentionHashtagHourlyCountsDays', '60', 'INTEGER', 'GLOBAL', NULL,
   'Conservation des compteurs horaires des hashtags, en jours')
ON CONFLICT ("key") WHERE "scope" = 'GLOBAL' DO NOTHING;

COMMIT;

-- Vérification facultative :
SELECT "key", "value", "type", "description"
FROM public.setting
WHERE "scope" = 'GLOBAL'
  AND "key" LIKE 'retention%'
ORDER BY "key";
