# LMN24 — Guide TV mondial — Amelia / Winston / Murat — SCRUM-117

**Date :** 2026-11-21  
**Story :** [SCRUM-117](https://lmn24.atlassian.net/browse/SCRUM-117)  
**État :** moteur de planification/fusion, orchestration, verrou PostgreSQL, publication de révisions et tests **développés sur main**. **PAS ENCORE EXPLOITABLE** : pas de branchement au décodage XMLTV/JSON et au téléchargement réel, pas de planification quotidienne activée, pas de migration candidate déployée. Aucun GO public.

## 1. Livrables réalisés

### Sélection, priorité et fusion
- `apps/backend/src/tv/tv-import-policy.ts` : durée d'import entière **1..7 jours**, sélection automatique des **pays TV actifs**, import manuel d'un **pays désactivé**, sélection des sources nationales actives, avec droits de republication des programmes approuvés et preuve, tri par priorité pays puis ID.
- Fusion déterministe : intervalle UTC, source, identité externe, fingerprint, suppression des doublons techniques, priorité par pays et refus des chevauchements. **Aucune découpe fictive d'émission secondaire**. Si une couverture contiguë et attestée sur la plage complète manque, **ne pas remplacer** l'ancienne grille. Résultats `SUCCESS/PARTIAL/ERROR/INTERRUPTED` et reprise des scopes `ERROR/INTERRUPTED` uniquement. Les corrections MANUAL de chaîne/numéro ne sont jamais écrites par ce moteur.
- `tv-import-policy.test.ts` : pays actif vs manuel inactif, ordre des sources, collisions, doublons, intervalles invalides, trous de couverture, statuts partiels.

### Suivi des imports
- `tv-import-runs.service.ts` : création atomique des `tv_import_run` et `tv_import_scope`, état `QUEUED`, événements, lecture bornée, reprise des scopes échoués dans un **nouveau run** sans toucher aux succès. Verrou d'ordonnancement PostgreSQL `pg_advisory_xact_lock(241024,87)` et refus **409 TV_IMPORT_SCOPE_BUSY** pour les pays déjà en file ou en cours.
- `tv-import-runs.controller.ts` et module : `POST /admin/tv/import-runs`, `GET /admin/tv/import-runs/:id`, `GET /admin/tv/import-runs/:id/events`, `POST /admin/tv/import-runs/:id/retry`. Toutes les opérations exigent une **session ADMIN**, `TV_CATALOG_ADMIN_ENABLED=true` **ET** `TV_IMPORTS_ENABLED=true`. Les deux drapeaux restent désactivés par défaut ; routes exclues de Swagger. Aucun endpoint public.
- `tv-import-runs.controller.test.ts` : 401/403/503, validation 1..7, UUID, impossibilité de forger un déclenchement automatique depuis HTTP, création/lecture/reprise protégées.

### Atomicité et concurrence
- `tv-import-publisher.ts` : acquisition de la **même session de verrou global (241024,85)** que le parser LMN24, mise à jour `parser_write_epoch` sous verrou transactionnel (241024,86), `ownerToken` par run, `AbortSignal` en cas de perte de connexion, publication sous transaction et `SET LOCAL app.tv_writer_owner`.
- Étapes : `STAGING` -> insert airings -> `VALIDATED` -> `PUBLISHED` -> comparaison atomique `tv_schedule_current` par `revisionId` attendu, sous verrou `variant/date`. En cas d'échec : `ROLLBACK`, révision courante antérieure conservée. Pas d'insertion hors pays/variante ; chaque source publiée doit être active et autorisée pour les programmes dans ce pays, avec justificatif de droits.
- `tv-import-worker.ts` : orchestrateur **interne**, à alimenter par un futur décodeur validé. Traite les pays, conserve les publications réussies quand un autre périmètre échoue, écrit événements nettoyés (pas d'URL/secrets), traite les états PARTIAL, déclenche la publication si couverture complète. **Non appelé par scheduler ni route HTTP** tant que les branchements externes ne sont pas qualifiés.
- `tv-import-retention.ts` : tâche **interne non planifiée** ; logs d'événements >30 jours supprimables sous lease et snapshots **non publiés** obsolètes supprimables hors pointeur courant. **Les révisions publiées restent immuables et ne sont pas supprimées par ce module** ; voir réserve AC06.

### Test d'intégrité SQL
- `docs/BMAD/guide-tv-mondial-scrum117-import-atomic-isolated-smoke.sql` : fixture PG17 jetable avec ancien snapshot, révision STAGING, refus de pointer un snapshot non publié, conservation de l'ancienne grille, refus de mutation d'un airing publié, publication validée sous lease, CAS, conservation de l'historique. Transaction terminée par `ROLLBACK`.
- Intégré dans `.github/workflows/tv-guide-isolated-validation.yml` ; validation **isolée**, pas copie fidèle de production.

## 2. Écarts restants avant de déclarer SCRUM-117 terminée

| AC | Implémenté | À finaliser |
|---|---|---|
| AC01 | Sélection pays / durée / queue manuelle | Planificateur quotidien, réelle ingestion EPG, y compris chaînes désactivées ; branchement seulement sous contrôle d'exploitation |
| AC02 | Priorité, dédoublonnage, gestion chevauchement et couverture | Décodage réellement sécurisé **XMLTV, XMLTV_GZIP, JSON**, mapping vérifié et consolidation multi-sources ; tests de source défaillante / correction MANUAL en SQL réel |
| AC03 | Publication atomique, STAGING/VALIDATED/PUBLISHED, refus de l'écrasement sans couverture | Tests d'intégration de l'exécuteur `processQueuedTvRun` sur DB complète migrée |
| AC04 | Verrou global, epoch fencing, CAS, queue 409 par pays | Watchdog complet sur lease du worker, récupération des jobs interrompus après crash, preuve de concurrence multiprocessus et idempotence de nouvelles requêtes |
| AC05 | Run/scopes/events, PARTIAL, relance des scopes échoués | Supervision UI, régénération des événements détaillés et parcours HTTP complet |
| AC06 | Suppression événements >30 jours, snapshots STAGING/VALIDATED obsolètes hors courant | Politique de purge réelle des **révisions publiées** conservées 7 jours puis suppression sous une procédure approuvée, sans violer les triggers d'immuabilité ni effacer les pointeurs courants |

**Important :** la méthode de fusion initiale refuse plutôt que de tronquer les programmes traversant la frontière UTC de la journée. Les tranches traversant minuit devront être modélisées explicitement en journées locales IANA (23/25 h DST) par l'adaptateur de normalisation avant homologation. Aucun début/fin inventé.

## 3. Risques et gates inchangés

- **SCRUM-114** bloque toujours la migration effective et la disponibilité des 19 tables TV. Aucun accès, lecture ou écriture à la base de production.
- Les sources et licences réelles (SCRUM-116) restent à qualifier avant chaque publication ; aucune URL EPG externe téléchargée.
- Les API admin ne sont pas accessibles sans deux flags d'activation ; aucune activation dans les secrets de production.
- Le Guide TV public reste sous embargo strict avec les barrières Next/Nest de SCRUM-113. Un commit `main` ou une CI verte n'est jamais un GO.
- **Murat** doit obtenir une CI complète verte sur un **même SHA**, refaire les tests de coupure du propriétaire et les scénarios d'import PARTIAL, puis établir les preuves pour l'homologation.

## 4. Verdict

**Livraison technique intermédiaire**, prête pour poursuite de l'intégration et des tests isolés. **SCRUM-117 ne doit pas être clôturée en l'état**, car le parseur effectif, les imports automatiques et la rétention finale des snapshots publiés ne sont pas terminés. Cette séparation empêche de présenter une architecture non activée comme un service EPG opérationnel.


## 5. Itération finale Amelia / Murat — 21 novembre 2026

### Développements supplémentaires réellement publiés

- **Décodage EPG hors réseau** : `tv-epg-decoder.ts` lit XMLTV/XMLTV_GZIP et JSON via `xml2js@0.5.0` déclaré dans le package backend et dans le lockfile pnpm ; limite de 50 000 programmes et 48 MiB, conversion des offsets XMLTV en instants UTC, validation des durées, refus des DTD et des entités XML. Aucun contenu XML/JSON ne certifie automatiquement une couverture complète.
- **Jours IANA** : `tv-import-time.ts` calcule des bornes UTC de journées civiles locales sans supposer 24 h ; testés notamment Paris et New York en journées DST 23/25 h. La fusion `tv-import-policy.ts` conserve les vrais instants UTC des émissions traversant minuit, sans découpe fictive. Les attestations de couverture se calculent sur l'intersection réelle du jour.
- **Adaptateur de rapprochement** : `tv-epg-loader.ts` relie les données décodées à des identifiants de chaîne `VERIFIED` en base et à une variante explicitement associée au pays ; les programmes sont insérés de manière déterministe sous le verrou/fencing existant, avec synopsis/images uniquement si leurs droits respectifs sont approuvés. Les candidats issus d'une source partiellement échouée ne sont pas ajoutés à la fusion. Les certificats de couverture proviennent d'un **fournisseur de preuves indépendant injecté**. Par défaut `noCoverageAttested` ne valide **aucun intervalle** ; une simple déclaration du fournisseur EPG ne suffit jamais.
- **Exécution contrôlée** : `tv-import-authorized-runner.ts` connecte le downloader, le parseur, le chargeur et le worker, mais **refuse d'exécuter** sans cinq paramètres explicites : `TV_CATALOG_ADMIN_ENABLED`, `TV_IMPORTS_ENABLED`, `TV_EPG_NETWORK_ENABLED`, `TV_MIGRATION_QUALIFIED` et `TV_EPG_SOURCE_USE_APPROVED`, tous à `true`. Aucun de ces paramètres n'est activé par le code, les workflows ou le présent document ; l'administration et le Guide TV restent fermés. Le worker **n'est pas lancé automatiquement** par l'application en l'absence de cet accord.
- **Planification** : `tv-import-scheduler.ts` est enregistré dans NestJS mais reste désactivé tant que trois paramètres administratifs/automatiques explicites ne sont pas à `true`. Il programme des runs `AUTOMATIC` de J0 à J+6, chaque jour à 03:00 UTC, avec une vérification PostgreSQL idempotente par jour calendaire. Il **crée uniquement des demandes** ; l'exécution réseau nécessite l'activation distincte du runner et son déploiement supervisé.
- **Crash / fencing** : `tv-import-recovery.ts` met les anciens runs `RUNNING` en `INTERRUPTED` ou `PARTIAL` lorsqu'un nouvel acteur possède le verrou global, conservant les scopes déjà réussis ; le worker l'appelle avant le run suivant. `tv-import-publisher.ts` inclut un watchdog sur la connexion verrouillée.
- **Purge J-7 et 30 j** : les deux prototypes SQL candidats autorisent uniquement la suppression des révisions `PUBLISHED` réellement expirées sous `SET LOCAL app.tv_retention=true` et jeton de verrou valide ; toute mutation normale reste impossible. `tv-import-retention.ts` retire les pointeurs courants expirés sous fencing, purge les révisions après sept jours civils locaux et les événements/runs terminés de plus de 30 jours sans supprimer le catalogue. La migration reste **candidate documentaire et non appliquée**.
- **Tests ajoutés** : `tv-epg-decoder.test.ts`, `tv-import-time.test.ts`, `tv-import-worker.test.ts`, `tv-epg-loader.test.ts`, `tv-import-scheduler.test.ts`, `tv-import-authorized-runner.test.ts`, fixture SQL `guide-tv-mondial-scrum117-retention-recovery-isolated-smoke.sql`, et scénario SQL de publication atomique préexistant. Tous sont hors réseau et hors production.

### Tableau d'acceptation mis à jour

| Critère | Résultat constaté | Encore exigé avant fermeture |
|---|---|---|
| AC01 — quotidien/manual 1..7 | Planificateur UTC intégré et drapeaux OFF ; demandes par pays même inactif en mode manuel | Démarrage supervisé d'un worker et démonstration quotidienne bout en bout avec source explicitement autorisée |
| AC02 — fusion/licences | XMLTV/JSON, mapping `VERIFIED`, droits par famille, priorité par pays, date IANA, source en échec mise en quarantaine | Attestations de couverture réelles, scénario multi-sources sur copie fidèle, droits sources réels approuvés |
| AC03 — snapshots atomiques | Fencing, staging, CAS, refus des révisions non publiées et protection d'ancienne grille ; tests PG jetables | Recette réelle du chargeur + publisher sur copie fidèle migrée |
| AC04 — locks/reprise | Lease exclusif, watchdog, idempotence de queue, reprise des runs abandonnés, isolation sous PostgreSQL | Essais multiprocessus et coupure réseau sur worker complet, preuve de récupération |
| AC05 — PARTIAL/retry | Journaux, statuts, reprise ciblée des scopes échoués, unit tests avec erreur source | Recette HTTP/admin et supervision UI sur schéma intégré |
| AC06 — rétention | SQL candidate + code de purge sous autorisation explicite, script isolé de preuve | Validation complète sur copie fidèle et raccordement du job de rétention |

### Verdict Murat

Les tests **isolés et unitaires** sont une preuve technique importante, mais **ne constituent pas une homologation de production**. Pour la clôture effective de SCRUM-117, il manque la répétition sur **copie fidèle anonymisée** et la vérification des **sources réelles et de leurs droits**, non autorisées dans cette conversation ; une CI complète verte sur un même SHA est aussi requise. **Ne pas clôturer SCRUM-117 en se fondant uniquement sur les fichiers ou les tests isolés.**

Aucune connexion de production, appel réseau réel EPG, migration officielle ni publication publique n'a été effectué.
