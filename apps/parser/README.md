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


## SCRUM-71 — Collecte Météo mondiale (Open-Meteo)

Moteur météo côté `@lmn24/parser`, indépendant des parsers Infos et Vidéos.
Il charge **les villes actives** de `weather_city`, par continent ou dans
l'ensemble du monde, regroupe les coordonnées en lots d'au plus **8 villes**
et interroge `https://api.open-meteo.com/v1/forecast` avec les paramètres
`current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,is_day`,
`timezone=GMT`, `timeformat=unixtime`, °C et km/h.

- **Aucune API fournisseur par visite** : relevés persistés dans `weather_current`
  (dernier par ville, mise à jour conditionnée à une date d'observation non
  antérieure), sans création d'historique climatique.
- Timeout par requête : 6 secondes ; au plus deux tentatives par lot ;
  réponse limitée à 250 000 caractères ; contrôles stricts des relevés, dates
  UTC, humidité, vent, code WMO et indicateur jour/nuit.
- Chaque lancement crée une ligne durable `weather_run` avec ID, mode,
  continent, compteurs, statut RUNNING puis SUCCESS/PARTIAL/ERROR et erreurs
  synthétiques assainies. Les erreurs d'un relevé n'empêchent pas l'import
  des autres relevés du même lot.
- Le début des exécutions concurrentes est sérialisé via un verrou
  transactionnel PostgreSQL. Une exécution RUNNING empêche le démarrage
  d'une autre ; les anciens RUNNING datant de plus de 45 minutes sont
  classés INTERRUPTED lors du prochain lancement.
- **Pas de CRON météo actif dans SCRUM-71**. Le moteur accepte déjà
  `trigger=AUTOMATIC` pour une future planification SCRUM-80.
- **SCRUM-72** ajoutera le bouton admin, les droits de lancement côté
  NestJS, et l'affichage d'avancement; les routes internes ci-dessous
  ne doivent **pas** être exposées directement à Internet.

### API interne (port 3002, en-tête `x-parser-secret` obligatoire)

- `POST /weather-runs` avec corps `{}` ou `{"continentCode":"EU"}`
  → **202** `{"accepted":true,"runId":"..."}` ; 409 si déjà occupé.
- `GET /weather-runs/:runId` → dernière progression et résultat d'un run.
- `GET /weather-runs` → 20 dernières exécutions météo.

Pour un essai **local** avec un secret configuré, depuis PowerShell :

```powershell
$headers = @{ "x-parser-secret" = $env:PARSER_SHARED_SECRET }
Invoke-RestMethod -Method Post -Uri "http://localhost:3002/weather-runs" -Headers $headers -ContentType "application/json" -Body '{"continentCode":"EU"}'
```

Attendre que le résultat de `GET /weather-runs/<runId>` passe de
RUNNING à SUCCESS, PARTIAL ou ERROR. Vérifier aussi la table
`weather_current` dans Prisma Studio. Une collecte nécessite les
migrations/seeds **SCRUM-69**, une connexion PostgreSQL fonctionnelle
et l'accès sortant HTTPS au domaine `api.open-meteo.com`.

En production, vérifier les quotas/licences du fournisseur et afficher
l'attribution Open-Meteo sur le frontend (SCRUM-74).
Référence : https://open-meteo.com/en/docs
