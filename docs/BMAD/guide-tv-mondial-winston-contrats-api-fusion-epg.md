# LMN24 — Guide TV mondial — Winston — Contrats API et fusion EPG v0.4

**Date :** 2026-11-20  
**Statut :** spécification d'architecture proposée, **aucune route / table / migration créée**.  
**Sources internes :** [cadrage Mary](./guide-tv-mondial-mary-cadrage-fonctionnel.md), [architecture v0.2](./guide-tv-mondial-winston-architecture-detaillee.md), [données/migrations v0.3](./guide-tv-mondial-winston-modele-donnees-migrations.md).  
**Embargo :** aucune route, API, carte ou lien Guide TV public avant le GO explicite du propriétaire.

## 1. Ancrage dans l'existant (vérifié sur main)

- `apps/backend/src/parser/parser-gateway.service.ts` appelle le parser interne avec `PARSER_INTERNAL_URL` et `x-parser-secret`, sans exposer le secret au navigateur.
- `apps/backend/src/parser/parser.controller.ts` propose déjà des démarrages asynchrones `202` et des flux d'événements SSE. Le contrôleur météo possède une validation stricte et exige le rôle ADMIN ; le module TV devra adopter la même politique côté serveur.
- `apps/parser/src/global-parser-lock.ts` utilise le verrou session PostgreSQL `(241024,85)`, son `ownerToken`, un signal d'annulation et un watchdog. `apps/parser/src/parser-engine.ts` exécute les écritures avec `fencedParserWrite`. Aucun import TV ne doit contourner cette protection.
- `apps/backend/src/scheduler/scheduler-settings.controller.ts` ne connaît pas le type TV ; il faudra une extension du scheduler et de ses tests, **sans activation automatique**.
- Aucune route TV publique n'existe dans l'arborescence vérifiée. Le booléen `TV_GUIDE_PUBLIC_ENABLED=false` n'est pas encore un garde complet des routes non créées.

## 2. Principes contractuels

- Base des routes **indicative**, à figer avec Sally et l'équipe avant développement. Séparer `/public/tv/*` et `/admin/tv/*`.
- Avant GO : tout endpoint public TV renvoie **404** générique, `Cache-Control: no-store`, sans résultat, image, metadata ni information de catalogue ; aucune entrée dans le sitemap. La couche NestJS et la route Next.js doivent chacune appliquer le gate serveur.
- API admin : session + rôle ADMIN vérifiés **à chaque endpoint** ; erreurs 401/403 indépendantes du layout Next.js ; modifications protégées contre les écrasements concurrents.
- Types partagés dans `packages/contracts` ; validation d'entrée Zod ou équivalent déjà utilisé ; réponses cohérentes. Tous les IDs persistants sont UUID, les dates d'instants ISO 8601 UTC, les jours civils YYYY-MM-DD et les fuseaux IANA.
- Résultats publics filtrés par pays TV actif **et** chaîne dans ce pays active ; aucune émission issue d'une source non autorisée à la republication.
- Aucun « programme fictif » en base. Les états vides et lacunes sont de simples présentations construites à partir des intervalles.

## 3. Contrats publics proposés

### 3.1 Catalogue des pays

`GET /public/tv/countries?locale=fr`

```json
{
  "items": [
    { "countryIso2": "FR", "label": "France", "referenceTimeZone": "Europe/Paris" }
  ],
  "languages": ["fr", "en", "de", "es", "pt", "it", "ru", "nl"],
  "datePolicy": { "daysAhead": 7, "reference": "COUNTRY_TIME_ZONE" }
}
```

Les pays sont publiés uniquement s'ils sont actifs pour le Guide TV. `languages` décrit les langues d'interface proposées pour les contenus, **pas** la disponibilité garantie de programmes traduits.

### 3.2 Vue des quatre onglets

`GET /public/tv/schedule?country=FR&language=all&localDate=2026-11-20&tab=TONIGHT&timeDisplay=CHANNEL&page=1&pageSize=50`

Valeurs : `tab=CHANNELS|NOW|TONIGHT|LATE`, `timeDisplay=CHANNEL|VISITOR`. Pour `VISITOR`, le fuseau du visiteur est communiqué explicitement depuis le navigateur sous forme d'un IANA `viewerTimeZone` (ou conversion 100% frontend depuis UTC), **jamais déduit de l'IP**. Préférer UTC+timezone dans l'API et formatage au frontend, même si `timeDisplay` reste un paramètre UI.

```json
{
  "countryIso2": "FR",
  "referenceTimeZone": "Europe/Paris",
  "localDate": "2026-11-20",
  "tab": "TONIGHT",
  "sort": "COUNTRY_CHANNEL_NUMBER_ASC",
  "items": [
    {
      "channel": {
        "id": "00000000-0000-4000-8000-000000000001",
        "number": 2,
        "name": "Exemple TV",
        "logoUrl": null,
        "broadcastLanguages": ["fr"]
      },
      "variant": {
        "id": "00000000-0000-4000-8000-000000000002",
        "timeZone": "Europe/Paris"
      },
      "programmeState": "AVAILABLE",
      "airing": {
        "id": "00000000-0000-4000-8000-000000000003",
        "startsAt": "2026-11-20T19:45:00Z",
        "endsAt": "2026-11-20T21:30:00Z",
        "title": "Émission d'exemple",
        "category": "Magazine",
        "imageUrl": null,
        "description": null
      }
    },
    {
      "channel": {
        "id": "00000000-0000-4000-8000-000000000004",
        "number": 3,
        "name": "Chaîne de démonstration",
        "logoUrl": null,
        "broadcastLanguages": ["fr"]
      },
      "variant": null,
      "programmeState": "EPG_UNAVAILABLE",
      "airing": null
    },
    {
      "channel": {
        "id": "00000000-0000-4000-8000-000000000005",
        "number": 4,
        "name": "Autre chaîne",
        "logoUrl": null,
        "broadcastLanguages": ["fr"]
      },
      "variant": null,
      "programmeState": "NO_START_IN_WINDOW",
      "airing": null
    }
  ],
  "pagination": { "page": 1, "pageSize": 50, "hasNext": false }
}
```

Les UUID et émissions ci-dessus sont **fictifs** et servent uniquement à illustrer le contrat.

- `EPG_UNAVAILABLE` = « Programme non disponible ».
- `NO_START_IN_WINDOW` = « Aucun programme débutant sur cette plage », uniquement si une grille suffisamment fiable couvre la plage visée ; sinon `EPG_UNAVAILABLE`.
- `AVAILABLE` = fiche d'émission cliquable.
- `NOW` seulement lorsque `localDate` est la date du jour dans le fuseau de référence du pays ; futur -> `422 TV_NOW_ONLY_TODAY` (et UI désactivée).
- `TONIGHT` : début local dans [20:30,21:30] ; `LATE` : [22:30,23:30] ; départ strict, sans afficher l'émission commencée avant.
- L'ordre est par numéro de chaîne national croissant, non par heures de départ. Une chaîne reste une carte même avec plusieurs variantes.
- Pour le programme qui chevauche le début et la fin de journée, la grille détaillée du jour l'inclut par intersection temporelle, sans modifier l'heure réelle de début.

### 3.3 Fiche chaîne, grille quotidienne, fiche diffusion

- `GET /public/tv/channels/:channelId?country=FR&locale=fr`
- `GET /public/tv/channels/:channelId/airings?country=FR&variantId=...&localDate=YYYY-MM-DD`
- `GET /public/tv/airings/:airingId?locale=fr`

La fiche chaîne doit préciser : numéro dans le pays, identité, pays, langues, variantes avec IANA, descriptions disponibles / langue source, réseaux officiels, `officialLiveUrl` facultative ; le bouton « Regarder en direct » est **sur la page de chaîne uniquement**, jamais sur les émissions. Le lien ouvre le site officiel, sans player embarqué.

```json
{
  "channelId": "00000000-0000-4000-8000-000000000001",
  "variantId": "00000000-0000-4000-8000-000000000002",
  "localDate": "2026-11-20",
  "timeZone": "Europe/Paris",
  "airings": [
    {
      "id": "00000000-0000-4000-8000-000000000003",
      "startsAt": "2026-11-20T19:45:00Z",
      "endsAt": "2026-11-20T21:30:00Z",
      "title": "Émission d'exemple"
    }
  ],
  "gaps": [
    { "startsAt": "2026-11-20T00:00:00Z", "endsAt": "2026-11-20T19:45:00Z", "reason": "EPG_UNAVAILABLE" }
  ]
}
```

**Attention :** la plage `gaps` de cet exemple ne couvre pas la journée réelle Europe/Paris complète ; l'implémentation devra calculer les bornes 00:00–24:00 locales converties en UTC, y compris DST. Les lacunes ne constituent pas des émissions enregistrées.

### 3.4 Recherche mondiale

`GET /public/tv/search?q=2&page=1&pageSize=30` : requête numérique **exacte** sur numéro par pays ; texte partiel sur noms et titres disponibles, insensible aux accents/casse, sans traduction de requête. Réponse `channels[]`, `programmes[]`, pagination distincte ou curseurs par groupe. Tri pays puis numéro croissant ; variantes d'une même chaîne regroupées, résultat pays distinct si numérotation nationale différente ; programmes limités au calendrier publié J0–J+6.

## 4. Contrats d'administration

| Méthode / route | But | Règles |
|---|---|---|
| `GET /admin/tv/countries` | Pays et fuseaux | ADMIN |
| `PATCH /admin/tv/countries/:countryId` | Activer pays, fuseau IANA | Contrôle de version / `expectedUpdatedAt` |
| `GET /admin/tv/channels` | Catalogue, nouveaux désactivés | Filtres pays, statut, recherche |
| `PATCH /admin/tv/channels/:id` | Numéro, identité, liens, activation | Corrections manuelles prioritaires |
| `GET /admin/tv/sources` | Sources et droits | Statut des droits et priorités |
| `POST /admin/tv/import-runs` | Import manuel global/pays | `days:1..7`, même pays inactifs |
| `GET /admin/tv/import-runs/:id` | État, compteurs, erreurs | Pas de fuite de secret |
| `GET /admin/tv/import-runs/:id/events` | SSE ou pagination d'événements | ADMIN, borné |
| `POST /admin/tv/import-runs/:id/retry` | Reprise scopes échoués | Idempotence, pas de doublons |
| `GET /admin/tv/statistics` | Résumé et par pays | Couverture et qualité |
| `GET /admin/tv/translation-providers` | Liste & statut | Jamais exposer clés en clair |
| `PATCH /admin/tv/translation-providers/:id` | Configuration, sélection manuelle | Un seul fournisseur sélectionné |
| `POST /admin/tv/channels/:id/translate` | Traduire descriptions absentes | Source, langues ; résultat PARTIAL autorisé |
| `POST /admin/tv/channels/:id/discover-links` | Suggestion de liens depuis site officiel | SSRF, aperçus, validation avant sauvegarde |

Démarrage d'import : 

```json
{
  "countryIso2": null,
  "days": 7,
  "includeInactiveCountries": true,
  "reason": "MANUAL"
}
```

Réponse HTTP 202 : `{"runId":"...","status":"QUEUED"}`. Déroulement `QUEUED -> RUNNING -> SUCCESS|PARTIAL|ERROR|INTERRUPTED`. Les scans peuvent durer longtemps ; **pas** de traitement synchrone dans la requête HTTP.

Réponse partielle des traductions : 

```json
{
  "status": "PARTIAL",
  "providerId": "active-provider",
  "translated": { "en": "Example description", "de": "Beispielbeschreibung" },
  "failed": { "ru": "UNSUPPORTED_LANGUAGE", "nl": "PROVIDER_UNAVAILABLE" },
  "persisted": false,
  "message": "Vérifiez les champs proposés avant enregistrement."
}
```

Aucun suivi de quota et **aucun basculement automatique** ; changement de fournisseur manuellement en administration, puis relance seulement des langues manquantes. Ne pas écraser les descriptions MANUAL.

## 5. Format d'erreur commun

```json
{
  "error": {
    "code": "TV_IMPORT_SCOPE_BUSY",
    "message": "Un traitement est déjà en cours sur ce périmètre.",
    "details": null,
    "requestId": "opaque-request-id"
  }
}
```

| HTTP | Code | Comportement |
|---|---|---|
| 400 | `TV_INVALID_FILTER`, `TV_INVALID_TIME_ZONE` | Rejeter saisie invalide |
| 401 | `UNAUTHENTICATED` | Administration sans session |
| 403 | `FORBIDDEN` | Non-ADMIN |
| 404 | `TV_NOT_FOUND`, `TV_PUBLIC_NOT_RELEASED` | Même réponse neutre pour routes publiques fermées ; ne pas donner l'état de publication |
| 409 | `TV_IMPORT_SCOPE_BUSY`, `TV_CONCURRENT_EDIT` | Réessai ou actualisation |
| 422 | `TV_NOW_ONLY_TODAY`, `TV_LICENSE_NOT_APPROVED` | Incohérence métier |
| 429 | `TV_RATE_LIMITED` | Limitation d'appels / abus (distincte de tout suivi de quota de traduction) |
| 502/503 | `TV_UPSTREAM_FAILED`, `TV_PARSER_UNAVAILABLE` | Import échoué, ancienne grille conservée |

Ne jamais renvoyer URL confidentielle, clé API, cookie, extrait XML malveillant ou détail interne des exceptions dans les réponses publiques.

## 6. Algorithme de rapprochement des chaînes

1. Chercher `(sourceId, externalChannelId)` dans `tv_channel_external_id` : si vérifié, associer à la chaîne/variante.
2. À défaut, utiliser métadonnées (nom, pays, langues, site officiel, numéro) pour **proposer une correspondance**, sans auto-fusion irréversible basée sur le nom.
3. Si correspondance non sûre : créer **une nouvelle chaîne désactivée** ou un alias `PENDING_REVIEW`, sans l'activer.
4. Les différences de variantes d'une même chaîne nationale ne créent **pas** plusieurs cartes publiques.
5. Une correction administrative d'identité ou de numéro survit aux imports futurs.

## 7. Fusion EPG déterministe et sans données inventées

Pour un périmètre `(country,variant,localDate)` :

1. Charger uniquement les sources actives et **autorisées à la republication** pour la grille publique.
2. Parser et normaliser les instants en UTC. Rejeter intervalle `end <= start`, année/date incohérente, source impossible.
3. Dédupliquer les émissions strictement identiques (source, identité externe, début/fin).
4. Trier les candidats : priorité de source **par pays**, qualité des identifiants, période de couverture, puis ordre stable indépendant de l'ordre de téléchargement.
5. Pour les événements chevauchants : garder le programme de priorité supérieure sur son intervalle ; prendre ceux des sources secondaires **uniquement dans les trous réellement disponibles**. Ne pas tronquer un programme secondaire et lui attribuer artificiellement de faux horaires : si conflit non résoluble, laisser lacune ou demander revue.
6. Fusionner uniquement les métadonnées manquantes quand la correspondance d'émission est suffisamment fiable ; conserver une provenance par champ.
7. Valider absence d'overlaps incompatibles, ordre temporel, sources autorisées et couverture mesurée.
8. Construire une révision immuable ; aucun pointeur public changé durant le staging.
9. Dans la même transaction SQL que le passage `tv_schedule_current`, verrouiller `(variant,date)`, vérifier le bail/owner token via fencing, garantir l'unicité.
10. En cas d'erreur, `ROLLBACK` : ancienne révision toujours lisible ; status de scope en ERROR/PARTIAL, relançable.

### Corrections d'émissions
Une émission **décalée** n'est pas deux émissions : comparer identifiant externe + chaîne/variante + plage temporelle avec prudence. Une émission **supprimée** disparaît de la nouvelle révision si la source qui fait autorité couvre correctement la plage ; en revanche ne pas supprimer sur simple panne/absence de flux. Journaliser `ADDED`, `UPDATED`, `MOVED`, `REMOVED` et les preuves de couverture.

### Politique de qualité préconisée
- Refuser données invalides, collisions non résolues, sources sans droits, dates hors période ou données manifestement tronquées.
- Conserver la révision en place en cas de **panne** ou d'absence inexplicable de données.
- Accepter une réduction réelle de couverture quand une source autorisée confirme la nouvelle grille ; ne pas « figer » les anciennes émissions devenues fausses.
- Les seuils numériques de baisse admissible sont **à décider après mesures**, pas arbitrairement fixés dans cette étude.

## 8. Scénarios de concurrence et de reprise

| Cas | Exigence testable | Comportement attendu |
|---|---|---|
| A : import manuel pendant l'automatique | Un seul writer par scope ou global | 409 / file d'attente, pas deux bascules concurrentes |
| B : perte de connexion/verrou du parser | Le worker perd le `ownerToken` | Abandon/rollback de toute écriture, pas de publication obsolète |
| C : deux sources donnent des programmes contradictoires | Priorité par pays | Source prioritaire, conflit tracé, aucune double diffusion |
| D : secondaire couvre un vrai trou | Fusion de sources | Insérer programme entier uniquement si intervalle compatible |
| E : source primaire indisponible | Ancienne grille valide | Ne pas remplacer par grille vide |
| F : échec d'un pays dans import global | Un pays échoue, autres réussissent | Runs PARTIAL, autres grilles publiées, relance ciblée |
| G : changement numéro en cours d'import | Correction MANUAL | Préserver priorité de l'admin, conflit unique par pays |
| H : chaîne inconnue dans pays désactivé | Import manuel | Chaîne créée désactivée, jamais publiée |
| I : passage heure d'été / heure d'hiver | Jour de 23 h ou 25 h | Aucune émission fantôme, bornes UTC correctes |
| J : absence de démarrage entre 20:30 et 21:30 | Grille confirmée | NO_START_IN_WINDOW, sans substituer l'émission en cours |
| K : changement de priorité d'une source | Nouvelle priorité sur prochain import | Récalcul contrôlé, ancien snapshot jusqu'à publication |
| L : retry après succès partiel | Scopes déjà réussis | Idempotence, ne pas réécrire les mêmes révisions |
| M : sources avec droits non confirmés | Données non réutilisables | Quarantaine admin ; exclusion des lectures publiques |
| N : expiration J-7 pendant lecture | Purge concurrente | Pas de référence cassée, révision courante protégée |

Le verrou global du parser actuel limite potentiellement tous les traitements du site. L'architecture TV devra conserver le fencing et réévaluer la granularité des verrous **avant** d'augmenter la concurrence ; ne jamais retirer la protection existante simplement pour accélérer le Guide TV.

## 9. Référentiel des tests

- **Unitaires** : normalisation temps, calcul fenêtres, attribution numéro, alias, déduplication, priorité, conflits, statuts vides, traduction partielle.
- **PostgreSQL isolé** : contraintes uniques effectives, FK de révision courante, transaction sous bail perdu, rollback, purge J-7, reprise simultanée, migration additive / bootstrap neuf.
- **API** : JSON validé, 400/401/403/404/409/422/5xx, rôle ADMIN, taille/pagination, cache `no-store` sous embargo.
- **E2E frontend** : quatre onglets, écran mobile, visiteur à autre fuseau, différents pays, recherche numérique, une seule carte par chaîne et par pays, aucune indexation des émissions.
- **Embargo avant GO** : aucun bouton visible, URLs Next.js et NestJS fermées, sitemap sans TV, pas de fuite via métadonnées ou résultats de recherche.
- **Non-régression** : flux RSS, vidéos, météo et horoscope continuent à fonctionner malgré le nouveau type de job.

## 10. Passages de relais et décisions encore ouvertes

- **Winston + Mary** : politique précise pour jour de référence du pays vs jour de variante lors de navigation, définition du seuil de qualité EPG.
- **Sally** : maquettes et spécification du résultat partiel, des lacunes, de la grille et des cartes mobiles.
- **Winston + Murat** : tests de concurrence et sécurité des flux entrants (SSRF, XXE, zip bombs).
- **John** : découpage Epic/US après validation de ce contrat, du modèle SQL et des écrans.
- **Propriétaire LMN24** : aucun GO de publication n'a été donné. Même une CI verte n'autorise aucune exposition publique.

**Cette note est une spécification. Aucun développement, import ni requête web externe n'a été lancé.**
