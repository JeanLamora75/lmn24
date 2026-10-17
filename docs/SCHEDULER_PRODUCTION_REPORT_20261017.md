# LMN24 — Compte rendu du déploiement du planificateur — 17/10/2026

## Synthèse
- **Déploiement technique réussi ; premières exécutions non encore vérifiées.**
- OVH Ubuntu, `~/lmn24`, services systemd `lmn24-frontend` (3000), `lmn24-backend` (3001), `lmn24-parser` (3002).
- Merge code : PR [#109](https://github.com/JeanLamora75/lmn24/pull/109) `7feb594a`, correction [#110](https://github.com/JeanLamora75/lmn24/pull/110) `ed04c08`, activation [#111](https://github.com/JeanLamora75/lmn24/pull/111) `332585b`.
- Compilation, `pnpm typecheck`, `pnpm build`, endpoints de santé et services actifs confirmés pendant le déploiement.
- **CI GitHub** des PR de correction et activation passée au vert.

## Sauvegarde et base de données
- Base `lmn24`, propriétaire `lmn24_app`, UTF-8.
- Dump préalable `/var/backups/lmn24/lmn24-before-scheduler.dump` : 9,8 Mo, catalogue lisible par `pg_restore --list`. Aucun essai complet de restauration n'a été effectué.
- SQL appliqué : `20261017_scheduler_foundations.sql`, `20261017_scheduler_job_ownership.sql`, `20261017_parser_write_fence.sql`.
- Droits supplémentaires accordés à `lmn24_app` après erreur PostgreSQL 42501 sur `scheduler_config` ; script reproductible `20261017_scheduler_application_grants.sql`.
- Quatre lignes configurées avec `is_enabled=true` après activation manuelle dans l'administration.

## Configuration de production
- Service parser : `node --env-file=/home/ubuntu/lmn24/.env dist/main.js`.
- `NODE_ENV=production`, `SCHEDULER_ENABLED=true`, `SCHEDULER_INTERNAL_SECRET` aléatoire 64 caractères ; ne jamais copier le secret dans un ticket ou document.
- Absence de `PARSER_INFOS_CRON` et `PARSER_VIDEOS_CRON` dans le `.env` contrôlé.
- `Central scheduler enabled`, `production:true`, observé dans les logs à 17:51:52 le 17/10. Interface admin avec 4 interrupteurs et enregistrement opérationnel.
- Correction du faux `Modification concurrente` : comparaison correcte du timestamp PostgreSQL à la milliseconde (PR #110).

## Échéances observées dans scheduler_config (Europe/Paris)
| Parser | Fréquence | Première échéance |
|---|---|---|
| INFOS | 60 min | 17/10/2026 20:00 |
| VIDEOS | 120 min | 17/10/2026 20:00 |
| WEATHER | 240 min | 17/10/2026 22:00 |
| HOROSCOPE_IMPORT | Tous les jours à 06:15 | 18/10/2026 06:15 |

Au dernier contrôle du 17/10 avant 20:00, `scheduler_job` contenait 0 ligne. Les champs `last_scheduled_at` étaient vides. Ce sont des constats cohérents avec des échéances futures, pas une validation des moteurs.

## Vérifications restantes et critères de clôture
1. **17/10 à partir de 20:00** : INFOS puis VIDEOS, contrôler en base `scheduler_job`, les logs, les créations réelles d'articles et de vidéos, l'absence de chevauchement du verrou global.
2. **17/10 à partir de 22:00** : WEATHER, contrôler statut du job, fournisseur Open-Meteo et mises à jour de `weather_current`.
3. **18/10 à partir de 06:15** : HOROSCOPE_IMPORT, contrôler appel backend privé, secret partagé, import idempotent, fichiers du jour et reprises si fichier absent.
4. Documenter durée, volumes, statuts ERROR/PARTIAL/INTERRUPTED, collision manuel/auto, reprise sur interruption, et comportement de désactivation.
5. Vérifier une restauration effective du dump sur une base de test et l'absence de divulgation des secrets avant clôture d'exploitation.

Requêtes de contrôle et conduite à tenir : [SCHEDULER_PRODUCTION_ENABLEMENT.md](./SCHEDULER_PRODUCTION_ENABLEMENT.md).

## Tickets Jira à rattacher
SCRUM-83 (modèle), SCRUM-84 (orchestrateur), SCRUM-85 (verrou), SCRUM-86 (admin), SCRUM-87 (Infos/Vidéos/Météo), SCRUM-88 (Horoscope), SCRUM-89 (reprise), SCRUM-90 (supervision), SCRUM-91 (tests/documentation). Séparer **livré techniquement** de **validé en production**.
