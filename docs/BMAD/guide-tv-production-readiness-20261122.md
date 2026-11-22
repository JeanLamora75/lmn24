# Guide TV mondial — passage en production (état au 22 novembre 2026)

## Statut : NO-GO sur l'installation SQL

La production OVH ne dispose pas des tables TV. Le code TV présent sur `main` n'installe pas ces tables automatiquement.

- `docs/BMAD/guide-tv-mondial-winston-migration-candidate.sql` est **expressément non déployable** : ne pas l'exécuter sur une base LMN24 réelle.
- `database/migrations/20261121_tv_channel_activation_optional_number.sql` et `database/migrations/20261121_tv_epg_source_scope.sql` supposent le schéma TV déjà installé. Ne pas les appliquer avant la migration initiale.
- `database/seed_tv_countries_249.sql` est explicitement limité à local/test en attendant homologation.
- `database/seed_tv_epg_sources_candidates.sql` contient des sources non qualifiées juridiquement ; ne pas les activer par défaut.
- `scripts/deploy-production.sh` sauvegarde, déploie et redémarre le code **sans migration de base** : il ne suffit pas à mettre en service le Guide TV.

## Contrôles préalables

1. Exécuter `database/tests/tv_production_preflight.sql` en lecture seule sur une connexion autorisée pour identifier les dépendances et tout schéma TV partiel.
2. Construire et faire approuver une migration initiale officielle à partir du candidat, avec revue des 19 tables, clés, contraintes, triggers, fonctions et privilèges du rôle applicatif `lmn24_app`.
3. Vérifier le contrat SQL du backend, y compris l'activation sans numéro, les deux colonnes du périmètre EPG, les droits sur tables/séquences et la fonction de fencing du parser.
4. Exécuter la migration et les seeds autorisés sur une **copie isolée restaurée de la production**, puis les smoke tests SQL et applicatifs.
5. Vérifier sauvegarde et restauration indépendante avant installation en production. Le script SQL et les seeds ne doivent pas être exécutés avant cette validation.
6. Après validation seulement : appliquer migration initiale, puis migrations additionnelles, puis graines de pays (sans activer les sources EPG non approuvées) ; enfin déployer **un SHA exact** via le script existant et contrôler les trois services.

## Garde-fous d'exploitation

Ne jamais appliquer le fichier candidat de `docs/BMAD` directement. Ne pas combiner un déploiement du code sans schéma TV avec l'activation du Guide TV public. Garder `TV_PUBLIC_ENABLED` et les accès réseau EPG désactivés jusqu'aux contrôles. Ne pas modifier ni supprimer les données des autres modules.

Les commandes SSH de production doivent être construites après vérification du nom réel de base, des prérequis, du schéma et du plan de sauvegarde/restauration.
