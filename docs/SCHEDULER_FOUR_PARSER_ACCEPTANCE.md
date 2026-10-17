# LMN24 — Chantiers 2 : tests intégrés des quatre parsers

Mise à jour : 2026-10-17. Branches de revue : PR #108 (fencing métier), PR #109 (acceptation scheduler).

## Périmètre validable automatiquement

1. Les quatre types `HOROSCOPE_IMPORT`, `INFOS`, `VIDEOS`, `WEATHER` sont activés **uniquement dans une base PostgreSQL jetable GitHub Actions** et leurs jobs sont insérés.
2. `dispatchOneSchedulerJob` sélectionne un seul job à la fois en ordre de priorité, appelle l'exécuteur correspondant, enregistre statut et nombre de tentatives, puis vérifie l'absence de jobs RUNNING oubliés.
3. Une exécution manuelle qui retient le verrou global provoque `BUSY` et retour du job à PENDING sans consommation de tentative.
4. Une exécution qui termine `ERROR` passe en réessai puis en erreur terminale après la troisième tentative.
5. Les trois adaptateurs existants retransmettent SUCCESS/ERROR/PARTIAL et refusent le succès si un batch est introuvable.
6. Les tests existants couvrent : import Horoscope absent (HTTP 404), backend indisponible (503), conflit verrou (409), format JSON, DST Europe/Paris, prise de propriété, perte du verrou, récupération après SIGKILL, et fencing transactionnel.

## Limites explicites — non équivalentes à une recette réelle des quatre moteurs

- Les exécuteurs du test scheduler PostgreSQL sont **instrumentés** : ils prennent le vrai verrou mais n'appellent pas les réseaux RSS, YouTube, Open-Meteo ou le service NestJS d'import. Les moteurs métier disposent de tests unitaires distincts.
- Une campagne fonctionnelle sur environnement isolé doit fournir des flux RSS/Atom et Open-Meteo de test, ainsi qu'un jeu JSON Horoscope sur huit langues, puis examiner les données effectivement créées dans PostgreSQL et les logs.
- Le refus d'activation du scheduler en production reste en place. Ne jamais activer les quatre paramètres de production en bloc pour valider la CI.
- Après une fusion éventuelle en code désactivé : sauvegarde, migrations et rollback VPS obligatoires.

**Ne pas déclarer le chantier entièrement terminé avant une CI verte au dernier commit et la recette de bout en bout avec les quatre moteurs réels.**
