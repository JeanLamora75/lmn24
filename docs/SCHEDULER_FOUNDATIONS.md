# Fondations d'automatisation — SCRUM-83 à SCRUM-85

## État actuel et règle de sécurité
Les moteurs d'actualité, vidéo, météo et import Horoscope **existent déjà** et leurs interfaces manuelles doivent être conservées. Ce lot introduit uniquement le schéma persistant de configuration et de file ; **aucun scheduler n'est activé par la migration**.

L'audit du code a trouvé :
- `apps/parser/src/run-manager.ts` : verrou en mémoire local à chaque moteur Infos/Vidéos (pas global).
- `apps/parser/src/weather-parser-engine.ts` : advisory lock de transaction utilisé à l'ouverture d'un run météo, ne couvrant pas toute l'exécution. Une expiration par TTL fixe peut marquer un run interrompu alors que le processus traite encore.
- `apps/parser/src/main.ts` : planifications Infos/Vidéos facultatives via `PARSER_INFOS_CRON` et `PARSER_VIDEOS_CRON`. Ces CRON doivent être désactivés/migrés avant activation du nouveau service pour éviter des sources de déclenchement concurrentes.
- Les imports Horoscope sont gérés côté administration/backend et nécessitent un adaptateur particulier au service existant.

## Données ajoutées
- `scheduler_config` : paramètres par parser, activation, intervalle ou heure quotidienne, échéance UTC, fuseau.
- `scheduler_job` : journal durable de la file, unicité par parser et échéance, tentatives et statuts.
- Configurations initiales désactivées : Infos 60 min, Vidéos 120 min, Météo 240 min, Horoscope quotidien 06:15 Europe/Paris.

## Suite obligatoire avant mise en service
1. SCRUM-84 : implémenter le distributeur, la persistance, le rattrapage sans exécutions dupliquées et le calcul DST.
2. SCRUM-85 : imposer un **verrou global couvrant toute la durée effective** de chacun des quatre moteurs, y compris les entrées manuelles. Une transaction advisory lock qui se clôt à la création du run est insuffisante.
3. Garantir que les traitements sont réellement terminés avant de libérer le verrou, avec reprise après crash, et désactiver l'ancien dispositif CRON indépendant.
4. Tester avec PostgreSQL réel, deux processus et redémarrages; étendre documentation et administration.

**Important** : les migrations n'autorisent pas à elles seules le lancement automatique. Aucun service ne doit être activé avant réussite de SCRUM-84/85 et des tests de concurrence.
