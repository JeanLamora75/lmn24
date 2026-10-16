# Frontend

Application Next.js de LMN24 : site public et future interface `/admin`.

## Stack initiale

- Next.js 16 / App Router
- React 19
- Bootstrap + React-Bootstrap
- next-intl
- TanStack Query
- React Hook Form + Zod

## Commandes

```bash
pnpm --filter @lmn24/frontend dev
pnpm --filter @lmn24/frontend build
pnpm --filter @lmn24/frontend lint
pnpm --filter @lmn24/frontend typecheck
pnpm --filter @lmn24/frontend test
```

Port par défaut : `3000`, configurable avec `FRONTEND_PORT`.


## SCRUM-75 — continent par défaut de la météo

La page publique `/[locale]/weather` sélectionne le continent **dès le rendu
serveur (SSR)**. L'ordre est strict :

1. **Choix manuel de l'utilisateur** : cookie de premier niveau
   `lmn24_weather_continent` (= `EU/AS/AF/NA/SA/OC`), valable 365 jours.
   Le cookie s'applique à `/` : changer de langue conserve le continent.
2. **Détection GeoIP approximative** : lorsque le site est déployé derrière
   **Cloudflare**, et que `WEATHER_GEOIP_PROVIDER=cloudflare` est configuré,
   Next.js utilise l'en-tête `CF-IPContinent` fourni par le proxy de confiance.
   Ce paramètre est désactivé par défaut.
3. **Repli** : Europe (`EU`) quand aucune donnée fiable n'est disponible.

Le bouton « Revenir à la détection automatique » efface le cookie puis recharge
le rendu serveur. Une valeur de cookie invalide est ignorée. Les valeurs
`XX`, `T1`, `AN` et autres codes inconnus sont ignorées. La locale et le
continent sont totalement indépendants.

### Installation derrière Cloudflare

**Important : ne jamais activer `WEATHER_GEOIP_PROVIDER=cloudflare`
sur un origin publiquement accessible**, car un client pourrait usurper
l'en-tête `CF-IPContinent`.

Configurer Cloudflare pour transmettre les en-têtes de géolocalisation,
restreindre les connexions à l'origin (pare-feu/IP Cloudflare ou Cloudflare
Tunnel), puis renseigner la variable dans l'environnement du frontend :

```dotenv
WEATHER_GEOIP_PROVIDER=cloudflare
```

Redémarrer le service Next.js. Vérifier le fonctionnement sur le déploiement
réel depuis différentes régions ou avec un test du proxy. Sur le poste local
sans Cloudflare, la sélection automatique doit rester **Europe**, et la sélection
manuelle doit survivre à un rafraîchissement et à un changement de langue.
La simple simulation de l'en-tête ne prouve pas qu'un reverse proxy est fiable.

### Confidentialité et fonctionnement

- Aucun appel à une API GeoIP tierce et **aucune permission GPS**.
- Aucun stockage de l'IP en base météo. Le cookie ne contient qu'un code
  continent ; `SameSite=Lax`, `Secure` en HTTPS.
- Une seule lecture météo est faite côté serveur pour le continent effectivement
  choisi : pas de « flash » visuel Europe → autre continent lors de l'hydratation.
- Ce système est prêt pour un hébergement OVH derrière Cloudflare ; sans proxy
  fiable il assure le choix manuel et le repli, **pas** une localisation automatique
  fondée sur l'adresse IP. Les horloges et pictogrammes Meteocons relèvent de
  SCRUM-76.

## SCRUM-76 — Meteocons et horloges des villes

Les cartes de `/[locale]/weather` chargent uniquement des SVG locaux
(`public/weather-icons/`) **Meteocons Flat statiques**, sous licence MIT
(voir `public/weather-icons/LICENSE-METEOCONS.txt`). La correspondance avec
le code WMO Open-Meteo et `isDay` se trouve dans
`src/components/weather/weather-icons.ts` ; les variantes soleil/lune,
nuages, précipitations, neige, brouillard et orages sont incluses.
Aucun CDN ni paquet npm supplémentaire n'est nécessaire.

L'heure locale est déterminée **côté navigateur** par
`Intl.DateTimeFormat` avec le champ IANA `timezone` de chaque ville.
Une seule horloge partagée pilote la grille entière, actualisée à chaque
changement de minute et lorsque l'onglet redevient visible. Avant
l'hydratation, « —:— » est affiché pour éviter les divergences serveur/client.
Les fuseaux invalides donnent « —:— » et ne bloquent pas les autres cartes.
Les textes de l'horloge sont traduits dans les huit langues.
L'heure d'observation et son statut frais/ancien/indisponible restent
indépendants de l'horloge locale : elle ne signifie pas que le relevé
météo est mis à jour chaque minute.

Tests : `pnpm --filter @lmn24/frontend test`, notamment
`weather-icons-clock.test.ts` qui vérifie les codes WMO, la présence des
assets, le jour/nuit, les transitions heure d'été/d'hiver et les fuseaux
invalides. Aucune migration SQL supplémentaire.

## SCRUM-78 — Purge météo manuelle et conservation

Deux tables météo sont désormais proposées depuis l'écran existant
`/admin/data-purge` (et **une seule table par opération**) :

- `weather_current` : supprime exclusivement les derniers relevés météo.
  Les villes, pays, fuseaux horaires, ordres d'affichage et statuts actifs
  de `weather_city` **restent intacts**. La page publique continue d'afficher
  les villes, mais les relevés absents deviennent « météo indisponible ».
  Une nouvelle collecte manuelle peut recréer ces relevés.
- `weather_run` : supprime exclusivement l'historique des exécutions terminées.
  Les statuts `RUNNING` ne sont jamais sélectionnés, même en vidage total.

Les deux durées de conservation sont modifiables depuis
`/admin/retention` :
`weatherCurrentRetentionDays=7` (comparaison à `observed_at`) et
`weatherRunRetentionDays=14` (comparaison à `started_at`).
Il s'agit de **jours**, distincts de `weatherStaleAfterMinutes=180`,
qui ne sert qu'à indiquer si une observation est périmée sur le site.
Une modification de durée **ne supprime rien** : elle ne change que le
seuil utilisé pour les purges ultérieures.

### Mise à jour de la base PostgreSQL locale — obligatoire

À partir de cette version, l'écran de rétention attend **11 paramètres**,
dont le nouveau `weatherCurrentRetentionDays` : réexécuter ces deux seeds
transactionnels et idempotents **après avoir sauvegardé la base**.
Ils conservent toutes les valeurs configurées précédemment.

```powershell
git switch main
git pull --ff-only origin main
psql -v ON_ERROR_STOP=1 -U postgres -d lmn24 -f database/seed_retention_settings.sql
psql -v ON_ERROR_STOP=1 -U postgres -d lmn24 -f database/seed_weather_settings.sql
pnpm dev
```

Les valeurs existantes de `weatherRunRetentionDays` sont préservées.
Aucune table ni colonne nouvelle n'est requise.

### Protections

L'API exige un compte ADMIN. Le frontend ne permet pas de sélectionner
`weather_city`; le backend refuse également cette table si elle lui est
envoyée directement. Chaque opération demande une prévisualisation chiffrée,
un jeton à usage unique lié à l'admin et valable trois minutes, une confirmation
explicite et, pour un vidage complet, la saisie exacte du nom de la table.

La purge est exécutée dans une transaction PostgreSQL avec verrou global.
Pour les tables météo, elle acquiert en plus le verrou utilisé par le
démarrage des parsers météo. **Une purge météo est refusée tant qu'une
exécution `RUNNING` existe.** La liste des candidats est revérifiée dans
la transaction avant chaque suppression. En cas d'écart avec la prévisualisation,
la transaction est annulée.

L'historique de purge affiché dans l'interface est lié à la session serveur :
ce n'est pas un audit historique permanent. Les opérations sont également
journalisées dans les logs applicatifs. La **purge automatique n'est pas
activée ici** ; sa planification est une étape distincte (SCRUM-57 / SCRUM-80).

Pour les tests PostgreSQL sur une base de test :
`database/tests/scrum_78_weather_purge_smoke.sql` exécute ses assertions
dans un `ROLLBACK` ; il ne laisse aucune donnée en base.
