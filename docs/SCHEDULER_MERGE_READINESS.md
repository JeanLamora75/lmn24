# LMN24 — Revue de consolidation du planificateur (SCRUM-82 à SCRUM-91)

Date : 2026-10-17. Branche candidate : `release/scrum-scheduler-candidate-20261017`.
PR candidate : #94 (base `main`).

## Éléments réellement validés

- CI GitHub Actions #562, sur le commit d'origine `7cf8320db673902bb109559fa934d20f4ca9b3fd` : tous les jobs verts (typecheck, lint, unit tests, build, schéma PostgreSQL et verrou Node interprocessus).
- Migrations scheduler et ownership rejouables dans la CI.
- Test du verrou global PostgreSQL, incluant l'arrêt brutal du processus détenteur.
- Tests de sélection de priorité et `FOR UPDATE SKIP LOCKED`.

La CI verte valide **les scénarios testés**, pas une disponibilité production.

## Points bloquant la fusion fonctionnelle / activation

- [ ] Tester l'intégration du déclenchement réel des quatre moteurs (Infos, Vidéos, Météo, Horoscope).
- [ ] Raccorder et tester la reprise des jobs orphelins après redémarrage. `recoverOrphanedSchedulerJobs` n'est pas encore invoqué dans `main.ts`. Ne pas raccorder sans audit des mécanismes de fencing.
- [ ] Tester les pertes de connexion entre réservation du job, acquisition du verrou et écritures métier ; prouver l'absence de doubles écritures.
- [ ] Vérifier la politique de réessai des fichiers Horoscope manquants, sa fenêtre horaire Europe/Paris et l'état terminal.
- [ ] Vérifier les anciennes variables `PARSER_INFOS_CRON` / `PARSER_VIDEOS_CRON` lors d'une bascule : éviter une double planification.
- [ ] Confirmer la CI propre à la PR #94 vers `main` et réviser les diffs complets.
- [ ] Préparer migration / sauvegarde PostgreSQL et procédure de retour arrière sur le VPS.

## Garde-fous

- Le schéma de migration installe quatre configurations `is_enabled=FALSE`.
- L'API admin interdit encore `isEnabled=true`.
- La boucle n'est disponible qu'avec `NODE_ENV !== production` ET `SCHEDULER_EXPERIMENTAL_RUN=true`.
- Pas de déploiement, migration production ou activation dans cette phase.

## Stratégie de consolidation

La PR #94 est une proposition **cumulative** basée sur la tête de la pile des PR #60–#93.
Ne pas fusionner chaque PR empilée puis #94 (risque de doublons et confusion de revue).
Utiliser #94 pour la revue globale, corriger ses blocages, obtenir une CI verte sur le commit final puis choisir une seule stratégie de fusion contrôlée.
