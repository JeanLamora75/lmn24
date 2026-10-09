# Parser

Service RSS/XML indépendant de LMN24.

## Responsabilités

- sélectionner les feeds actifs en base ;
- filtrer éventuellement par pays, langue et catégorie ;
- traiter les feeds séquentiellement ;
- lire les formats RSS/RDF/Atom ;
- extraire et normaliser les articles ;
- éviter les doublons par URL d'article ;
- alimenter Article, Feed et FeedRun ;
- exposer une API interne pour les lancements manuels ou externes ;
- diffuser l'avancement d'une exécution manuelle par Server-Sent Events.

## Endpoints internes

- GET /health
- POST /runs
- GET /runs/:runId/events

POST /runs accepte des filtres optionnels :

- countryIsoCode2
- languageIsoCode2
- categoryId

Sans filtre, tous les feeds actifs sont traités.

Les endpoints /runs exigent l'en-tête x-parser-secret correspondant à
PARSER_SHARED_SECRET. Une seule exécution peut être active à la fois.

## Settings PostgreSQL

Le parser lit les paramètres globaux suivants :

- parser.feed_timeout_seconds
- parser.feed_retry_count

## Commandes

```bash
pnpm --filter @lmn24/parser dev
pnpm --filter @lmn24/parser build
pnpm --filter @lmn24/parser lint
pnpm --filter @lmn24/parser typecheck
pnpm --filter @lmn24/parser test
```

Port par défaut : 3002, configurable avec PARSER_PORT.
