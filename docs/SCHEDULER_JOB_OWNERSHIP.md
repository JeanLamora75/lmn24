# SCRUM-89 — Contrat de possession continue du job

## Race identifiée et vérifiée dans le code

Le distributeur actuel marque la tâche `RUNNING` et termine la transaction
**avant** que le parser ne demande le verrou global. Entre ces deux actions,
le mécanisme de récupération peut trouver le verrou libre et remettre la tâche
en `PENDING`. Le filtre d'ancienneté de PR #70 réduit le risque mais
n'assure pas l'exclusion mutuelle.

Une tentative consistant à acquérir le verrou pendant le claim puis à le
libérer avant l'exécuteur a été retirée : elle conserve précisément cette
fenêtre. Une seconde tentative qui gardait le verrou dans le distributeur
ne pouvait pas fonctionner avec les wrappers existants (double acquisition
sur deux sessions PG) et le pont HTTP Horoscope. Elle a été retirée également.

## Contrat requis avant activation

1. **Réserver** le travail sous une identité de propriétaire (`owner_token`
   aléatoire et unique par tentative), sur la même transaction que le passage
   à `RUNNING`. La réservation doit s'accompagner d'un verrou/fencing qui
   demeure valable de bout en bout.
2. **Déclencher** les moteurs Infos, Vidéos, Météo et l'import Horoscope dans
   une seule zone d'exclusion mutuelle partagée entre processus.
   Pour le pont HTTP Horoscope, choisir explicitement entre un propriétaire
   d'orchestration unique avec transfert de token vérifié côté backend ou
   une réservation dans PostgreSQL que le backend acquiert atomiquement.
   Deux acquisitions indépendantes du même advisory lock ne conviennent pas.
3. **Heartbeats et fencing** : chaque écriture finale de statut et chaque
   renouvellement doit vérifier `owner_token`. Une tâche réclamée par un
   nouveau propriétaire ne doit jamais pouvoir être terminée par l'ancien.
4. **Récupération** : acquérir le même protocole de propriété et ne toucher
   que les exécutions dont le heartbeat est expiré ; avant de les remettre en
   `PENDING`, s'assurer que l'ancien moteur ne peut plus écrire.
5. **Échec de connexion** : arrêter le travail en cours de manière effective
   ou arrêter le processus ; journaliser `INTERRUPTED` sans succès fictif.
6. **Désactivation** : les paramètres des quatre parsers restent à
   `is_enabled = false` tant que cette garantie n'est pas prouvée.

## Scénarios de recette bloquants

- Deux distributeurs essaient de réserver le même job.
- Un parser manuel démarre au même instant qu'un job automatique.
- Crash après réservation, avant lancement du moteur.
- Crash pendant traitement / perte de connexion du verrou.
- Backend Horoscope lent ou HTTP interrompu ; jamais deux imports simultanés.
- Reprise concurrente d'une ancienne exécution pendant le claim d'une nouvelle.
- Redémarrage du VPS après une longue indisponibilité (rattrapage compacté).
- Changement d'heure Europe/Paris pour le déclenchement Horoscope.

**Situation actuelle :** le protocole ci-dessus n'est pas implémenté.
Les PR #60 à #70 constituent des fondations en brouillon, non autorisées
pour une activation automatique en production.
