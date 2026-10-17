# SCRUM-89 — Implémentation du fencing des jobs

Implémentation initiale : `scheduler_job.owner_token` (UUID) et
`scheduler_job.heartbeat_at` (TIMESTAMPTZ). Les mutations de jobs RUNNING
sont désormais conditionnées à la valeur du token actif.

## Migration

Après `20261017_scheduler_foundations.sql`, appliquer
`20261017_scheduler_job_ownership.sql` sur un environnement de test.
La contrainte `scheduler_job_running_owner_chk` est créée NOT VALID pour
ne pas invalider silencieusement d'anciens RUNNING. Réconcilier les lignes
historiques avant `VALIDATE CONSTRAINT`.

## Fonctions

- `scheduler-job-ownership.ts`: claim atomique conditionnel, heartbeat,
  fin et réinsertion en file sous token.
- `scheduler-dispatcher.ts`: sélection transactionnelle SKIP LOCKED,
  attribution du token et heartbeat toutes les 10 s pendant l'appel.
- `scheduler-recovery.ts`: reprise uniquement si heartbeat antérieur
  à la limite de sécurité, et mise à jour conditionnelle sur le token
  constaté pour exclure les écritures d'un ancien propriétaire.

## Limites bloquantes

Le fencing protège **le registre des jobs**, mais pas encore toutes les
écritures métier des moteurs Infos, Vidéos, Météo ou Horoscope. Un worker
bloqué plus longtemps que le délai d'expiration pourrait continuer à écrire
lorsqu'il se réveille si le lock global a été perdu. Les moteurs doivent
être forcés à s'arrêter en cas de perte de verrou ou supporter un token
de fencing jusqu'aux mutations des données métier.

Ne pas lancer automatiquement `recoverOrphanedSchedulerJobs` tant que
le protocole de verrou et le mécanisme de reprise n'ont pas été validés
par tests de panne et multi-processus. Vérifier notamment le verrou perdu
pendant le traitement Horoscope côté backend.

Aucun timer ni activation dans l'administration n'est ajouté dans ce lot.
Les tests de compilation et de PostgreSQL réel ne sont pas certifiés.
