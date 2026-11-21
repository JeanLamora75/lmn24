# LMN24 Guide TV — Déclenchement manuel du worker depuis l'administration

Date : 21 novembre 2026 — périmètre SCRUM-117 / SCRUM-122.
État : développement livré sur `main`, QA GitHub Actions à qualifier sur le SHA final.

## Règles de sécurité non négociables

- `POST /admin/tv/import-runs/:id/execute` est limité aux sessions ADMIN
  et au corps strict `{"mode":"DISCOVERY"}` ; aucune exécution automatique.
- Le backend vérifie le statut `QUEUED` du run, la présence de DATABASE_URL et
  les cinq autorisations : `TV_CATALOG_ADMIN_ENABLED`,
  `TV_IMPORTS_ENABLED`, `TV_EPG_NETWORK_ENABLED`,
  `TV_MIGRATION_QUALIFIED`, `TV_EPG_SOURCE_USE_APPROVED`.
- Aucune des autorisations n'est activée par le code ou par le bouton.
  L'existence d'un flux public, sa déclaration `APPROVED` dans le formulaire
  ou la disponibilité d'une URL ne valent pas autorisation de collecte.
- La découverte n'écrit que les identifiants externes inconnus
  `tv_channel_external_id` en `PENDING_REVIEW` et les événements/statuts
  techniques du run. Même en présence de mappings `VERIFIED` et de droits
  programmes `APPROVED`, le mode découverte **n'écrit aucun**
  `tv_programme`, `tv_airing`, `tv_schedule_revision`.
- Contrôle global du writer lease/transactions/fencing préexistant ;
  une double soumission dans un même process est rejetée. Une autre
  instance ne peut pas acquérir le lease déjà détenu.
- Le traitement n'est pas attaché au cycle de vie de la requête HTTP.
  Le frontend suit les états/events via lecture toutes les 5 secondes.
  Un échec précoce du démarrage du worker peut laisser le run `QUEUED`
  ; ne jamais inférer un succès du seul résultat `STARTED`.
- `GET /admin/tv/import-runs/execution-status` indique `ready` et les
  flags non satisfaits pour aider l'ADMIN, sans modifier les flags.
  `ready` est la disponibilité technique des garde-fous, pas une preuve juridique.
- Le Guide TV public reste protégé indépendamment par son embargo.

## Recette fonctionnelle

1. Import France/1 jour existant `92d055fc-8c55-4407-9954-976debd1345b`,
   source Teleonline active, statut `QUEUED`.
2. En l'absence des cinq validations, la page Imports doit expliquer le
   blocage et désactiver « Exécuter la découverte des chaînes ».
   Aucun téléchargement ni publication.
3. Avec approbations techniques/juridiques *réelles et tracées*, déclencher
   l'action, vérifier `STARTED`, puis `RUNNING` et `SUCCESS/PARTIAL/ERROR`,
   ainsi que les événements et `PENDING_REVIEW`.
4. Avant de déclarer `PASS` : tests isolés de décodage XMLTV/GZIP,
   protections réseau/SSRF, accès anonyme/éditeur, doubles clics,
   chargement multi-pays et absence de publication.
5. Si réseau non autorisé, les tests unitaires offline prouvent les
   garde-fous et la logique mais ne valident pas le flux Teleonline réel.

## Implémentation

- Backend : `tv-import-execution.service.ts`,
  `tv-import-runs.controller.ts`, `tv-import-authorized-runner.ts`,
  `tv-epg-loader.ts`, module TV.
- Frontend : route proxy strictement listée dans
  `apps/frontend/src/app/api/admin/tv/[...path]/route.ts`,
  `TvAdminWorkspace.tsx`.
- Tests : `tv-import-execution.service.test.ts`,
  `tv-import-runs.controller.test.ts`,
  `tv-epg-loader.test.ts`.
