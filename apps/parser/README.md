# Parser

Service de collecte indépendant pour les actualités RSS/XML, les vidéos YouTube et la météo mondiale de LMN24.

## Responsabilités

- sélectionner les feeds actifs en base ;
- filtrer éventuellement par pays, langue et catégorie ;
- traiter les feeds séquentiellement ;
- lire les formats RSS/RDF/Atom ;
- extraire et normaliser les articles ;
- éviter les doublons par URL d'article ;
- alimenter Article, Feed et FeedRun ;
- exposer une API interne pour les lancements manuels ou externes ;
- diffuser l'avancement d'une exécution manuelle Infos/Vidéos par Server-Sent Events ;
- collecter les nouvelles vidéos YouTube depuis leurs flux Atom ;
- collecter les observations météo actuelles des villes actives depuis Open-Meteo, par lots, sans appel du fournisseur lors de la consultation publique.

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

Port par défaut : 3002, configurable avec `PARSER_PORT`.

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
- **Depuis le correctif de production [PR #58](https://github.com/JeanLamora75/lmn24/pull/58)** : timeout de **15 secondes par tentative**, **3 tentatives maximum** pour les erreurs temporaires (HTTP 429/5xx et erreurs réseau), délais entre tentatives de **1,5 puis 4 secondes**.
- Respect de `Retry-After` pour temporiser, dans la limite de **30 secondes** ; si le fournisseur demande une attente plus longue, arrêter ce lot et différer une nouvelle collecte. Ne pas retenter les erreurs HTTP non temporaires (par exemple 400), les réponses JSON invalides ou trop volumineuses.
- Réponse limitée à **250 000** (contrôle de taille), validation stricte des relevés : dates UTC, température, humidité, vent, code WMO et indicateur jour/nuit.
- En cas d'échec, diagnostic synthétique avec code HTTP et, si l'API le fournit dans un JSON d'erreur, le motif `reason` ; les timeouts et échecs de connexion sont distingués. **Un échec HTTP du lot est comptabilisé pour toutes les villes du lot**, mais les observations valides déjà enregistrées restent conservées.
- Chaque lancement crée une ligne durable `weather_run` avec ID, mode,
  continent, compteurs, statut RUNNING puis SUCCESS/PARTIAL/ERROR et erreurs
  synthétiques assainies. Les erreurs d'un relevé n'empêchent pas l'import
  des autres relevés du même lot.
- Le début des exécutions concurrentes est sérialisé via un verrou
  transactionnel PostgreSQL. Une exécution RUNNING empêche le démarrage
  d'une autre ; les anciens RUNNING datant de plus de 45 minutes sont
  classés INTERRUPTED lors du prochain lancement.
- **SCRUM-72 est livré** : `/admin/weather-parser` permet à un ADMIN de lancer la collecte sur tous les continents ou sur un seul, de suivre son avancement, ses compteurs, ses erreurs et son historique. Le backend NestJS impose une session avec rôle ADMIN ; les routes internes ci-dessous exigent le secret du parser et **ne doivent pas être exposées directement à Internet**.
- **Protection d'origine derrière reverse proxy** : les mutations météo acceptent uniquement la même origine ou l'origine publique explicitement déclarée dans `WEATHER_ADMIN_PUBLIC_ORIGIN`. En production OVH, `https://www.lmn24.com` a été configuré après l'incident HTTP 403 ([PR #57](https://github.com/JeanLamora75/lmn24/pull/57)). Les origines tierces restent interdites.
- **Pas de CRON météo actif au MVP**. Le moteur accepte `trigger=AUTOMATIC` pour une future planification sous SCRUM-80, mais aucun déclenchement météo automatique n'est activé ici.

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

### Exploitation et validation sur OVH

- Les validations directes effectuées sur le VPS avec cURL en IPv4 (1 ville et 8 villes), puis avec Node.js `fetch` (8 villes), ont répondu HTTP 200. Des exécutions complètes renvoyaient toutefois des HTTP 503/timeouts **intermittents** ; la cause externe exacte n'a pas été démontrée. Le correctif PR #58 a renforcé la tolérance aux erreurs ; son fonctionnement a été **confirmé en production** par l'utilisateur.
- Pour diagnostiquer un nouvel incident : noter le statut et les compteurs dans `/admin/weather-parser`, tester ponctuellement Open-Meteo depuis le VPS avec cURL puis Node.js, et consulter `journalctl -u lmn24-parser -n 150 --no-pager`. Ne pas lancer des tentatives agressives pour contourner un refus ou un quota fournisseur.
- Conserver les relevés antérieurs lorsqu'un lot échoue et distinguer les données périmées dans la rubrique publique. L'attribution Open-Meteo doit rester visible ; quotas et licences restent à surveiller.
- Pour les prérequis VPS, la configuration de l'origine publique et les tests de diagnostic : [guide de déploiement OVH](../../docs/DEPLOY_OVH_MANUAL.md). Pour les scénarios de recette : [QA Météo MVP](../../docs/QA_WEATHER_MVP.md).

Référence fournisseur : https://open-meteo.com/en/docs
