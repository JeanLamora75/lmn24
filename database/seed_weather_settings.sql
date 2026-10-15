-- SCRUM-69 - Initial weather settings for future parser and purge stories.
-- Seed only; NO scheduled job or retention purge is enabled here.
-- Existing administrator choices are preserved on rerun.
BEGIN;
INSERT INTO public.setting ("key","value","type","scope","scope_id","description")
VALUES
  ('weatherCurrentRefreshMinutes','60','INTEGER','GLOBAL',NULL,
   'Intervalle cible du futur parser météo automatique (minutes), inactif au MVP'),
  ('weatherStaleAfterMinutes','180','INTEGER','GLOBAL',NULL,
   'Seuil après lequel un relevé météo doit être marqué comme ancien (minutes)'),
  ('weatherRunRetentionDays','14','INTEGER','GLOBAL',NULL,
   'Rétention prévue des exécutions terminées du parser Météo (jours)')
ON CONFLICT ("key") WHERE "scope" = 'GLOBAL' DO NOTHING;
COMMIT;

SELECT "key", "value", "type", "scope"
FROM public.setting WHERE "scope" = 'GLOBAL'
  AND "key" IN ('weatherCurrentRefreshMinutes','weatherStaleAfterMinutes','weatherRunRetentionDays')
ORDER BY "key";
