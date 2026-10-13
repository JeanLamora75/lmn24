# DATA_MODEL.md

## Objectif

Ce document décrit le modèle de données fonctionnel du projet **LMN24**.

Le site agrège des flux XML/RSS provenant de journaux du monde entier, les parse automatiquement, stocke les articles récupérés et les présente par langue et par catégorie. **Extension cible (non encore migrée)** : collecte de métadonnées de vidéos YouTube via Atom XML, sans hébergement des fichiers vidéo.

---

# 1. Country

Représente un pays utilisé pour rattacher les sources d’actualités et permettre le filtrage des contenus.

| Champ | Type | Obligatoire | Description |
|---|---|---:|---|
| `id` | UUID | Oui | Identifiant unique |
| `isoCode2` | String(2) | Oui | Code ISO 3166-1 alpha-2, ex. `FR` |
| `isoCode3` | String(3) | Oui | Code ISO 3166-1 alpha-3, ex. `FRA` |
| `slug` | String | Oui | Valeur utilisée dans les URL, ex. `france` |
| `isActive` | Boolean | Oui | Indique si le pays est disponible sur le site |
| `createdAt` | DateTime | Oui | Date de création |
| `updatedAt` | DateTime | Oui | Date de dernière modification |

### Contraintes

- `isoCode2` doit être unique.
- `isoCode3` doit être unique.
- `slug` doit être unique.
- Les codes pays utilisent la norme ISO 3166-1.
- Le nom affiché du pays n'est pas stocké en base : il est lu dans les fichiers multilingues via `isoCode2`.

### Exemple

- isoCode2 : `FR`
- isoCode3 : `FRA`
- slug : `france`
- isActive : `true`

---

# 2. Language

Représente une langue utilisée par les flux et par les pages d’actualités.

| Champ | Type | Obligatoire | Description |
|---|---|---:|---|
| `isoCode2` | String(2) | Oui | Clé primaire ISO 639-1, ex. `fr`, `en`, `de` |
| `isActive` | Boolean | Oui | Indique si la langue est active sur le site |
| `createdAt` | DateTime | Oui | Date de création |
| `updatedAt` | DateTime | Oui | Date de modification |

### Contraintes

- `isoCode2` est la clé primaire de la table.
- `isoCode2` est stocké en minuscules.
- Le nom affiché de la langue n'est pas stocké en base : il est lu dans les fichiers multilingues via `isoCode2`.

---

# 3. Category

Représente une catégorie d’actualité. La catégorie porte également les **paramètres de présentation de sa section sur la page d’accueil** : ces paramètres sont communs à toutes les langues et n’affectent pas les pages dédiées aux catégories.

Référentiel initial : Actualité, International, National, Sports, Faits divers, Technologie, Économie, Politique, Cinéma, Culture, Santé, Éducation, Société, Musique, Télévision, Radio.

| Champ | Type | Obligatoire | Description |
|---|---|---:|---|
| `id` | UUID | Oui | Identifiant unique |
| `slug` | String | Oui | Identifiant utilisable dans les URL et les traductions |
| `isActive` | Boolean | Oui | Statut actif/inactif, indépendant de la configuration de l’accueil |
| `displayOrder` | Integer | Oui | Position globale de la section sur l’accueil (`display_order` en PostgreSQL) |
| `layoutType` | Enum | Oui | Mise en page de l’accueil (`layout_type`), valeur initiale `GRID` |
| `themeColor` | String(7) | Oui | Couleur d’accent de l’accueil (`theme_color`), valeur initiale `#2563EB` |
| `createdAt` | DateTime | Oui | Date de création |
| `updatedAt` | DateTime | Oui | Date de modification |

### Contraintes

- `slug` est unique. Les libellés des catégories ne sont pas stockés en base : le `slug` sert de clé dans les fichiers de traduction multilingues sous `/messages`.
- `displayOrder` est un entier strictement positif, unique pour **toutes les catégories**, y compris inactives. Les positions persistées sont consécutives, de 1 à N.
- Lors de la migration des catégories existantes, les positions initiales suivent le `slug` alphabétique ; une nouvelle catégorie est ajoutée à la fin, avec protection contre les créations concurrentes.
- Les changements de classement sont sauvegardés **atomiquement** et protégés contre les modifications concurrentes ; une erreur ne doit pas laisser un ordre partiel.
- `layoutType` n’admet que les huit valeurs du catalogue ci-dessous.
- `themeColor` suit le format canonique `#RRGGBB` ; plusieurs catégories peuvent avoir la même couleur. Il s’agit d’un accent graphique, qui ne doit pas compromettre l’accessibilité.
- `isActive` n’est pas modifié par les réglages de mise en page. Une catégorie inactive conserve son ordre et sa présentation, mais n’apparaît pas sur l’accueil.
- `displayOrder`, `layoutType` et `themeColor` ne modifient **ni l’ordre des articles**, ni la présentation des pages publiques dédiées aux catégories.

### Catalogue des mises en page de l’accueil

La **capacité maximale** de chaque section est fixée par `layoutType` ; il n’existe **aucun champ de nombre d’articles** propre à la catégorie, ni paramètre `Setting` pour cette capacité sur la page d’accueil.

| `layoutType` | Présentation | Capacité maximale |
|---|---|---:|
| `FEATURED` | Un article principal, quatre secondaires | 5 |
| `GRID` | Grille 3 colonnes × 2 lignes (desktop) | 6 |
| `LIST` | Liste de cinq articles | 5 |
| `SPLIT` | Un grand article et deux secondaires | 3 |
| `MOSAIC` | Mosaïque : un grand article et quatre vignettes | 5 |
| `COMPACT` | Grille compacte 4 colonnes × 2 lignes (desktop) | 8 |
| `HEADLINES` | Liste dense de titres d’actualité | 10 |
| `CAROUSEL` | Six cartes dans un carrousel accessible | 6 |

Le rendu est responsive : la disposition change selon le terminal, mais la capacité du modèle reste identique. Lorsque le nombre d’articles disponibles est inférieur à cette capacité, seuls les articles réels disponibles sont affichés, sans doublon ni carte vide.

### Règles de sélection et de visibilité sur l’accueil

- Pour une page `/fr`, seuls les `Article` dont `languageIsoCode2 = fr` sont éligibles ; même principe pour `/en`, `/de`, `/es`, `/pt`, `/it` et `/ru`. Aucun mélange de langues ni repli vers une autre langue.
- Pour chaque catégorie active, sélectionner ses articles dans la langue demandée et les trier par **`publishedAt DESC`** (date réelle de publication), puis `id DESC` en cas d’égalité. Ne pas utiliser `createdAt` (date d’import) pour le tri.
- Limiter les résultats à la capacité de `layoutType`. **Une catégorie sans article éligible dans la langue demandée n’est pas affichée sur l’accueil**, sans modification de son statut ni de sa position persistée.
- Les sections visibles conservent leur ordre relatif `displayOrder ASC`. Les articles et les pages dédiées aux catégories restent indépendants de ces paramètres d’accueil.
- Si aucune catégorie n’a d’article éligible, la page d’accueil présente un état global « Aucune actualité disponible pour le moment ».

> Slugs officiels : `news`, `international`, `national`, `sports`, `faits-divers`, `technology`, `economy`, `politics`, `cinema`, `culture`, `health`, `education`, `society`, `music`, `television`, `radio`.

---

# 4. Source

Représente un journal ou média fournissant des actualités via un ou plusieurs flux XML/RSS.

| Champ | Type | Obligatoire | Description |
|---|---|---:|---|
| `id` | UUID | Oui | Identifiant unique |
| `name` | String | Oui | Nom du journal, ex. `Le Monde` |
| `slug` | String | Oui | Identifiant URL, ex. `le-monde` |
| `websiteUrl` | String | Oui | Site officiel du journal |
| `logoUrl` | String | Non | URL du logo |
| `rssPageUrl` | String | Non | URL informative de la page RSS du média (différente des flux `Feed`) |
| `facebookUrl` | String | Non | Lien vers le compte/page Facebook |
| `xUrl` | String | Non | Lien vers le compte X/Twitter |
| `instagramUrl` | String | Non | Lien vers le compte Instagram |
| `youtubeUrl` | String | Non | Lien vers la chaîne/compte YouTube |
| `description` | Text | Non | Présentation textuelle du média, 5 000 caractères maximum |
| `countryId` | UUID | Oui | Pays principal du journal |
| `isActive` | Boolean | Oui | Active ou désactive la source |
| `createdAt` | DateTime | Oui | Date de création |
| `updatedAt` | DateTime | Oui | Date de modification |

### Relations

- Une `Source` appartient à un `Country`.
- Une `Source` peut posséder plusieurs `Feed`.
- **Extension vidéo cible :** une `Source` peut posséder plusieurs `FeedVideo` et plusieurs `Video`.

### Contraintes

- `slug` doit être unique.
- `websiteUrl` doit être une URL valide.
- Les cinq URL additionnelles sont facultatives et limitées à 2 048 caractères ; les URLs sociales doivent appartenir au domaine de la plateforme correspondante.
- `description` est un texte libre de 5 000 caractères maximum, sans interprétation HTML.
- La page RSS est informative et n'entraîne aucune création automatique d'un `Feed`.
- Les six nouvelles colonnes sont facultatives afin de conserver les sources existantes sans perte de données.

---

# 5. Feed

Représente un flux XML/RSS provenant d’une `Source`.

| Champ | Type | Obligatoire | Description |
|---|---|---:|---|
| `id` | UUID | Oui | Identifiant unique |
| `sourceId` | UUID | Oui | Journal auquel appartient le flux |
| `categoryId` | UUID | Oui | Catégorie d’actualité |
| `languageIsoCode2` | String(2) | Oui | Code ISO 639-1 de la langue du flux |
| `feedUrl` | String | Oui | URL du flux XML/RSS |
| `isActive` | Boolean | Oui | Active ou désactive la récupération du flux |
| `lastFetchedAt` | DateTime | Non | Date et heure de la dernière récupération |
| `lastFetchDurationMs` | Integer | Non | Temps nécessaire pour récupérer et parser le flux, en millisecondes |
| `lastFetchStatus` | String | Non | Résultat de la dernière récupération : `SUCCESS`, `ERROR`, etc. |
| `lastError` | String | Non | Dernière erreur rencontrée |
| `createdAt` | DateTime | Oui | Date de création |
| `updatedAt` | DateTime | Oui | Date de modification |

### Relations

- Un `Feed` appartient à une `Source`.
- Un `Feed` appartient à une `Category`.
- Un `Feed` appartient à une `Language`.
- Un `Feed` peut posséder plusieurs `FeedRun`.

### Contraintes

- `feedUrl` doit être unique.
- `feedUrl` doit être une URL valide.
- `lastFetchDurationMs` est calculé automatiquement par le parseur.

---

# 6. Article

Représente une actualité provenant directement d’une `Source` (journal ou média).

| Champ | Type | Obligatoire | Description |
|---|---|---:|---|
| `id` | UUID | Oui | Identifiant unique |
| `sourceId` | UUID | Oui | Journal ou média auquel appartient l’article |
| `categoryId` | UUID | Oui | Catégorie de l’article |
| `languageIsoCode2` | String(2) | Oui | Code ISO 639-1 de la langue de l’article |
| `title` | String | Oui | Titre de l’article |
| `summary` | Text | Non | Résumé fourni par le flux |
| `imageUrl` | String | Non | URL de l’image associée |
| `articleUrl` | String | Oui | URL vers l’article original |
| `publishedAt` | DateTime | Oui | Date et heure de publication de l’article |
| `createdAt` | DateTime | Oui | Date et heure d’enregistrement dans la base |

### Relations

- Un `Article` appartient directement à une `Source`.
- Un `Article` appartient à une `Category`.
- Un `Article` appartient à une `Language`.

### Contraintes

- `articleUrl` doit être unique.
- `publishedAt` correspond à la date fournie par le flux.
- `createdAt` correspond à la date d’import dans LMN24.

---

# 7. FeedRun

Représente l’historique d’une exécution du parser pour un `Feed`.

Cette table permet de superviser les traitements, mesurer leurs performances et diagnostiquer les erreurs.

| Champ | Type | Obligatoire | Description |
|---|---|---:|---|
| `id` | UUID | Oui | Identifiant unique |
| `feedId` | UUID | Oui | Feed concerné par l’exécution |
| `startedAt` | DateTime | Oui | Date et heure de début du traitement |
| `finishedAt` | DateTime | Non | Date et heure de fin du traitement |
| `durationMs` | Integer | Non | Durée totale du traitement en millisecondes |
| `status` | String | Oui | Statut de l’exécution : `RUNNING`, `SUCCESS`, `ERROR`, etc. |
| `itemsFound` | Integer | Oui | Nombre d’éléments trouvés dans le flux |
| `articlesImported` | Integer | Oui | Nombre d’articles réellement ajoutés |
| `articlesSkipped` | Integer | Oui | Nombre d’articles ignorés, notamment car déjà présents |
| `errorMessage` | Text | Non | Message d’erreur éventuel |
| `createdAt` | DateTime | Oui | Date de création de l’enregistrement |

### Relations

- Un `FeedRun` appartient à un `Feed`.
- Un `Feed` peut posséder plusieurs `FeedRun`.

### Contraintes

- `durationMs` doit être positif ou nul lorsqu’il est renseigné.
- `itemsFound`, `articlesImported` et `articlesSkipped` doivent être positifs ou nuls.
- `finishedAt` peut être nul tant que le traitement est en cours.
- `errorMessage` est principalement utilisé lorsque `status = ERROR`.

---

# 8. Setting

Représente un paramètre configurable depuis l’interface d’administration.

| Champ | Type | Obligatoire | Description |
|---|---|---:|---|
| `id` | UUID | Oui | Identifiant unique |
| `key` | String | Oui | Clé technique du paramètre |
| `value` | String | Oui | Valeur du paramètre |
| `type` | String | Oui | `INTEGER`, `BOOLEAN`, `STRING`, `DURATION`, etc. |
| `scope` | String | Oui | `GLOBAL`, `CATEGORY`, `FEED` |
| `scopeId` | UUID | Non | Identifiant de la catégorie ou du feed concerné |
| `description` | String | Non | Description fonctionnelle |
| `createdAt` | DateTime | Oui | Date de création |
| `updatedAt` | DateTime | Oui | Date de modification |

### Exemples

#### Timeout spécifique d’un feed

- key : `feedTimeoutMs`
- value : `10000`
- type : `DURATION`
- scope : `FEED`

#### Timeout global par défaut

- key : `defaultFeedTimeoutMs`
- value : `15000`
- type : `DURATION`
- scope : `GLOBAL`

### Règle de surcharge

Un paramètre spécifique à un `Feed` ou une `Category` surcharge la valeur globale correspondante.

**Exception explicite :** le nombre d’articles affichés par section sur la page d’accueil n’est pas configurable dans `Setting` ; il est automatiquement déterminé par le `layoutType` de la catégorie. L’ordre et la couleur des sections sont également stockés sur `Category`.

### Rétention configurable (cible MVP)

Les durées de conservation utilisent des lignes **indépendantes** de `Setting`, toutes avec `scope = GLOBAL`, `scopeId = NULL`, `type = INTEGER`, `value` représentant un **nombre de jours strictement positif**. Aucune modification de structure de la table `setting` n'est nécessaire.

| Clé (`Setting.key`) | Défaut (jours) | Données concernées |
|---|---:|---|
| `retentionArticlesDays` | 60 | `article`, selon `published_at` |
| `retentionVideosDays` | 60 | `video`, selon `published_at` |
| `retentionInfoParserRunsDays` | 14 | `feed_run`, selon `started_at` |
| `retentionVideoParserRunsDays` | 14 | `feed_video_run`, selon `started_at` |
| `retentionInfoParserLogsDays` | 7 | Fichiers de logs techniques du parser RSS, s'ils sont conservés localement |
| `retentionVideoParserLogsDays` | 7 | Fichiers de logs techniques du parser vidéo, s'ils sont conservés localement |
| `retentionBackendLogsDays` | 7 | Fichiers de logs techniques du backend, s'ils sont conservés localement |
| `retentionHashtagHourlyCountsDays` | 60 | `hashtag_hourly_count`, selon `hour_utc` |

Le **seed SQL idempotent** est `database/seed_retention_settings.sql`. Modifier ces valeurs ne supprime aucune donnée tant que les tâches de maintenance ne sont pas développées et activées. Les fichiers Pino envoyés seulement sur stdout ou à un hébergeur externe suivent la politique de rétention de cet hébergeur : la valeur en base ne peut pas, à elle seule, les supprimer.

La conservation des séries hashtags ne doit pas dépasser l'horizon des articles ; les classements publics sont limités aux périodes effectivement couvertes. Les paramètres sont administrables uniquement par un administrateur, validés côté API et utilisés par les tâches planifiées. Les `Setting` eux-mêmes, sources, flux, catégories, langues et définitions de hashtags ne sont pas concernés par cette purge.

---

# 9. User

Représente un utilisateur autorisé à accéder aux interfaces d’administration.

| Champ | Type | Obligatoire | Description |
|---|---|---:|---|
| `id` | UUID | Oui | Identifiant unique |
| `email` | String | Oui | Adresse email de connexion |
| `passwordHash` | String | Oui | Hash du mot de passe |
| `firstName` | String | Non | Prénom |
| `lastName` | String | Non | Nom |
| `role` | String | Oui | Rôle utilisateur : `ADMIN`, `EDITOR`, etc. |
| `isActive` | Boolean | Oui | Autorise ou bloque l’accès |
| `lastLoginAt` | DateTime | Non | Date et heure de dernière connexion |
| `createdAt` | DateTime | Oui | Date de création |
| `updatedAt` | DateTime | Oui | Date de modification |

### Relations

- Un `User` peut posséder plusieurs `Session`.

### Contraintes

- `email` doit être unique.
- Le mot de passe ne doit jamais être stocké en clair.
- Seuls les utilisateurs actifs peuvent se connecter.
- Les droits d’accès dépendent du rôle.

### Rôles initiaux

- `ADMIN` : accès complet au paramétrage.
- `EDITOR` : gestion du contenu, des sources et des flux sans administration des utilisateurs.

---

# 10. Session

Représente une session d’authentification serveur persistée dans PostgreSQL pour un utilisateur de l’administration.

| Champ | Type | Obligatoire | Description |
|---|---|---:|---|
| `id` | UUID | Oui | Identifiant unique de la session |
| `userId` | UUID | Oui | Utilisateur auquel appartient la session |
| `tokenHash` | String | Oui | Hash du jeton de session envoyé au navigateur |
| `expiresAt` | DateTime | Oui | Date et heure d’expiration de la session |
| `revokedAt` | DateTime | Non | Date et heure de révocation manuelle de la session |
| `createdAt` | DateTime | Oui | Date et heure de création de la session |
| `updatedAt` | DateTime | Oui | Date et heure de dernière modification |

### Relations

- Une `Session` appartient à un seul `User`.
- Un `User` peut posséder plusieurs `Session`, par exemple sur plusieurs navigateurs ou appareils.

### Contraintes

- `tokenHash` doit être unique.
- Le jeton de session brut ne doit jamais être stocké en base.
- Une session est valide uniquement si elle n’est pas révoquée et si `expiresAt` est dans le futur.
- La suppression d’un utilisateur doit entraîner la suppression de ses sessions associées.
- Les sessions expirées peuvent être supprimées périodiquement.

---

# 11. Vue synthétique des relations

```text
Country
  └── Source
        ├── Feed
        │    └── FeedRun
        ├── Article
        ├── FeedVideo
        │    └── FeedVideoRun
        └── Video (avec lien optionnel vers FeedVideo)

Language
  ├── Feed
  ├── Article
  ├── FeedVideo
  └── Video

Category
  ├── Feed
  ├── Article
  ├── FeedVideo
  └── Video

Setting
  ├── GLOBAL
  ├── CATEGORY
  └── FEED

User
  ├── Accès aux interfaces d’administration
  └── Session
```

---

# 12. Principes retenus

- Le modèle doit rester simple pour le MVP.
- Les flux XML/RSS sont rattachés à une source, une langue et une catégorie.
- Les articles sont rattachés directement à leur `Source`, à leur `Category` et à leur `Language`. Le pays est hérité via la source. Il n’existe pas de relation persistée entre `Article` et `Feed`.
- Les paramètres techniques et fonctionnels doivent être configurables sans modifier le code.
- Sur la page d’accueil, les paramètres de présentation (`displayOrder`, `layoutType`, `themeColor`) sont portés directement par `Category` et le nombre d’articles par section dépend exclusivement du modèle choisi.
- La page d’accueil présente uniquement les articles de la langue sélectionnée, triés par date de publication (`publishedAt DESC`), et masque les catégories sans articles éligibles.
- Les traductions de l’interface, des pays, des catégories et des langues sont stockées dans des fichiers multilingues séparés sous `/messages`.
- Les données de dernier état du parseur sont stockées sur `Feed` et l’historique des exécutions est conservé dans `FeedRun`.
- **Extension vidéo cible :** `FeedVideo` conserve le dernier état de collecte, `FeedVideoRun` son historique et `Video` les métadonnées publiées. Le flux d'origine est tracé, sans confondre flux et contenu.
- Les mots de passe sont stockés uniquement sous forme de hash.
- Les sessions d’administration sont persistées dans PostgreSQL. Le navigateur conserve uniquement le jeton de session et la base stocke son hash.


---

# 13. Extension vidéo YouTube — modèle cible (à implémenter)

> **Statut : conception validée, documentation uniquement.** Les entités ci-dessous ne sont pas encore présentes dans `packages/database/schema.prisma` ni dans PostgreSQL. Leur création nécessite une future User Story, une migration Prisma/SQL et des tests. Le périmètre initial est **YouTube via Atom XML**, sans recours obligatoire à YouTube Data API ni hébergement des vidéos.

## 13.1. FeedVideo (table PostgreSQL `feed_video`)

Représente un flux de publications vidéo associé à une source. Une même `Source` peut gérer plusieurs chaînes/flux. La structure suit celle de `Feed`, tout en conservant une identité propre pour la collecte vidéo.

| Champ Prisma | Type | Obligatoire | Description |
|---|---|---:|---|
| `id` | UUID | Oui | Identifiant unique |
| `sourceId` | UUID | Oui | Référence vers `Source.id` |
| `categoryId` | UUID | Oui | Catégorie principale attribuée aux vidéos de ce flux |
| `languageIsoCode2` | String(2) | Oui | Langue principale ISO 639-1, référence à `Language.isoCode2` |
| `platform` | Enum | Oui | Plateforme vidéo ; valeur initiale `YOUTUBE` |
| `channelId` | String | Oui | Identifiant technique de chaîne YouTube (forme `UC...`), non son `@handle` |
| `feedUrl` | Text | Oui | URL Atom XML, ex. `https://www.youtube.com/feeds/videos.xml?channel_id=UC...` |
| `isActive` | Boolean | Oui | Collecte autorisée, valeur initiale `true` |
| `lastFetchedAt` | DateTime | Non | Dernière tentative de récupération |
| `lastFetchDurationMs` | Integer | Non | Durée de la dernière tentative (ms) |
| `lastFetchStatus` | String(32) | Non | `SUCCESS`, `ERROR`, etc. |
| `lastError` | Text | Non | Dernière erreur technique |
| `createdAt` | DateTime | Oui | Création, valeur initiale courante |
| `updatedAt` | DateTime | Oui | Dernière modification |

**Relations :** `FeedVideo → Source`, `FeedVideo → Category`, `FeedVideo → Language`, `FeedVideo → FeedVideoRun[]` et `FeedVideo → Video[]` (relation nullable côté vidéo).

**Contraintes :** `feedUrl` unique ; couple `(platform, channelId)` unique pour éviter d'importer la même chaîne plusieurs fois ; URL HTTPS YouTube autorisée et identifiant de chaîne cohérent avec l'URL ; durée positive ou nulle. Index sur `sourceId`, `categoryId`, `languageIsoCode2`, `isActive`, `lastFetchedAt`. Les clés étrangères de référentiels sont protégées contre la suppression accidentelle (`Restrict`). La désactivation d'un flux arrête seulement ses futures collectes, sans effacer les vidéos existantes.

**Convention :** la plateforme est modélisée comme un enum extensible ultérieurement ; ajouter une plateforme implique de définir un nouveau parseur et des règles de validation, pas simplement de changer `platform`.

## 13.2. Video (table PostgreSQL `video`)

Représente **les métadonnées d'une vidéo**, et non un fichier vidéo hébergé par LMN24. La vidéo appartient directement à une source et à une seule catégorie et langue pour le MVP ; elle conserve aussi, si disponible, le flux ayant permis sa découverte.

| Champ Prisma | Type | Obligatoire | Description |
|---|---|---:|---|
| `id` | UUID | Oui | Identifiant technique LMN24 |
| `sourceId` | UUID | Oui | Référence directe `Source.id` (même principe que `Article.sourceId`) |
| `feedVideoId` | UUID | Non | Flux à l'origine de la découverte, référence `FeedVideo.id` |
| `categoryId` | UUID | Oui | Catégorie unique pour le MVP |
| `languageIsoCode2` | String(2) | Oui | Langue de la vidéo |
| `platform` | Enum | Oui | `YOUTUBE` initialement |
| `platformVideoId` | String | Oui | Identifiant de vidéo renvoyé par la plateforme (`yt:videoId`) |
| `title` | Text | Oui | Titre fourni par le flux |
| `description` | Text | Non | Description provenant de la publication |
| `thumbnailUrl` | Text | Non | URL de vignette issue du flux, si disponible |
| `videoUrl` | Text | Oui | URL canonique publique de lecture YouTube |
| `publishedAt` | DateTime | Oui | Date/heure de publication (`published`) |
| `updatedOnPlatformAt` | DateTime | Non | Date de mise à jour signalée par le flux (`updated`) |
| `isPublished` | Boolean | Oui | Visibilité sur LMN24, valeur initiale `true` |
| `createdAt` | DateTime | Oui | Date de première importation dans LMN24 |
| `updatedAt` | DateTime | Oui | Date de dernière modification en base |

**Relations :** `Video → Source`, `Video → Category`, `Video → Language`, `Video → FeedVideo?`.

**Contraintes :** couple `(platform, platformVideoId)` unique afin de dédupliquer les vidéos indépendamment du flux d'origine ; index `sourceId`, `feedVideoId`, `categoryId`, `languageIsoCode2`, `publishedAt DESC` et `isPublished`. Une vidéo déjà présente ne doit pas être recréée lors d'une collecte ; ses métadonnées modifiées peuvent être mises à jour. Les URL doivent être HTTP(S) valides, et les liens de lecture doivent respecter les domaines de la plateforme. La suppression d'un flux référencé ne doit pas supprimer les vidéos : `feedVideoId` peut être mis à `NULL` si le flux est supprimé. La suppression d'une source/catégorie/langue référencée reste restreinte.

**Visibilité :** `FeedVideo.isActive` pilote la **collecte** ; `Video.isPublished` pilote la **publication**. Les vidéos restent en base si le flux est désactivé, et peuvent être masquées indépendamment dans l'administration.

## 13.3. FeedVideoRun (table PostgreSQL `feed_video_run`)

Historise chaque tentative du parser vidéo, indépendamment de `FeedRun` (articles).

| Champ Prisma | Type | Obligatoire | Description |
|---|---|---:|---|
| `id` | UUID | Oui | Identifiant unique |
| `feedVideoId` | UUID | Oui | Référence vers `FeedVideo.id` |
| `startedAt` | DateTime | Oui | Début d'exécution |
| `finishedAt` | DateTime | Non | Fin d'exécution (nulle si `RUNNING`) |
| `durationMs` | Integer | Non | Durée en millisecondes |
| `status` | String(32) | Oui | `RUNNING`, `SUCCESS`, `ERROR`, etc. |
| `itemsFound` | Integer | Oui | Entrées vidéo découvertes, défaut 0 |
| `videosImported` | Integer | Oui | Nouvelles vidéos enregistrées, défaut 0 |
| `videosSkipped` | Integer | Oui | Entrées ignorées/déjà connues, défaut 0 |
| `errorMessage` | Text | Non | Message d'échec, le cas échéant |
| `createdAt` | DateTime | Oui | Création de l'enregistrement |

**Relations :** `FeedVideoRun → FeedVideo` (obligatoire).

**Contraintes :** compteurs et durées non négatifs ; index `feedVideoId`, `startedAt DESC`, `status` et `(feedVideoId, startedAt DESC)`. L'historique permet de diagnostiquer les erreurs sans écraser le détail de l'exécution précédente.

## 13.4. Règles d'importation et limites de YouTube

1. Le parser vidéo récupère le flux Atom XML depuis `FeedVideo.feedUrl`, en respectant les délais, les erreurs HTTP/XML et les limites réseau.
2. Chaque entrée est identifiée par `yt:videoId` et dédupliquée via `(platform, platformVideoId)` ; l'appartenance à la source est dérivée du flux configuré, jamais d'un paramètre non fiable du XML.
3. `Category` et `Language` sont initialement héritées de `FeedVideo` ; un reclassement éditorial ultérieur doit pouvoir préserver la décision de l'administrateur.
4. Un flux YouTube n'expose qu'une fenêtre récente de publications : la récupération est **incrémentale**, non une reconstitution exhaustive de la chaîne. Prévoir un parser automatique périodique et un lancement manuel.
5. Les Shorts, directs et autres formats présents dans le flux sont éligibles par défaut ; aucune classification fiable n'est supposée sans métadonnées explicites.
6. La récupération ne stocke ni ne télécharge les fichiers vidéo. Le site public affiche une miniature et ouvre/embarque uniquement le lecteur officiel, en respectant les règles d'intégration et la confidentialité.
7. La valeur de `Source.youtubeUrl` reste un **lien social informatif** ; elle ne crée pas automatiquement de `FeedVideo`. Une fonction d'assistance pourra découvrir `channelId` puis proposer le flux à confirmer.
8. Le journal d'exécution renseigne toujours `FeedVideoRun` ; les champs `lastFetch*` de `FeedVideo` constituent seulement la vue du dernier état.

## 13.5. Impacts et séquencement de mise en œuvre

1. Établir la migration PostgreSQL / Prisma des trois tables, de l'enum et de leurs relations aux référentiels existants, avec vérification des index et contraintes SQL ; **aucune migration appliquée par cette modification documentaire**.
2. Développer les endpoints NestJS d'administration et les validations de flux vidéo.
3. Réaliser les écrans d'administration des flux vidéo, puis le parser Atom YouTube et l'historique des runs.
4. Ajouter l'administration des vidéos, leur dépublication et les interfaces publiques dédiées (rubrique Vidéos, onglets Source/Catégorie) avec pagination.
5. Étendre la page Statistiques, la supervision et les tests de fiabilité.

## 13.6. Vue des relations cible

```text
Country 1 ── N Source
               ├── N Feed ── N FeedRun       (articles, existant)
               ├── N Article               (existant)
               ├── N FeedVideo ── N FeedVideoRun
               └── N Video
                        └── 0..1 FeedVideo (flux d'origine, nullable)

Category 1 ── N FeedVideo ; Category 1 ── N Video
Language 1 ── N FeedVideo ; Language 1 ── N Video
```

---

# 14. Hashtags et tendances — modèle cible (à implémenter)

> **Statut : documentation de conception uniquement.** Les tables ci-dessous nécessiteront des modifications de `packages/database/schema.prisma` et une migration SQL/Prisma ultérieure. Elles ne sont pas créées par ce document.

## 14.1. Hashtag (table `hashtag`)

Sujet suivi par LMN24, administrable et visible dans un classement public.

| Champ Prisma | Type | Obligatoire | Description |
|---|---|---:|---|
| `id` | UUID | Oui | Identifiant |
| `name` | String(255) | Oui | Libellé de référence |
| `slug` | String(255) | Oui | Identifiant d'URL unique |
| `imageUrl` | Text | Non | Chemin relatif d'une image téléversée, stockée sur un volume persistant hors PostgreSQL |
| `isActive` | Boolean | Oui | Statut de visibilité et de suivi |
| `createdAt` | DateTime | Oui | Date de création |
| `updatedAt` | DateTime | Oui | Date de dernière modification |

**Contraintes :** `slug` unique ; les images ne sont pas stockées en binaire dans PostgreSQL. Les définitions de hashtags ne sont pas effacées par la purge temporelle.

## 14.2. HashtagAlias (table `hashtag_alias`)

Termes ou orthographes alternatifs d'un sujet (ex. « Moscou », « Moscow », « Москва »). L'alias peut être lié à une langue indicative, mais la recherche publique couvre **toutes** les langues et tous les alias du sujet.

| Champ Prisma | Type | Obligatoire | Description |
|---|---|---:|---|
| `id` | UUID | Oui | Identifiant |
| `hashtagId` | UUID | Oui | Référence `Hashtag` |
| `name` | String(255) | Oui | Variante recherchée |
| `languageIsoCode2` | String(2) | Non | Langue indicative, si connue |
| `createdAt` | DateTime | Oui | Date de création |

**Contraintes :** unicité des variantes normalisées au sein d'un hashtag ; index `hashtagId`. Le nom principal est également un terme recherché. Les frontières de mots, casse, accents et variantes Unicode doivent être traités sans faux positifs évidents.

## 14.3. HashtagHourlyCount (table `hashtag_hourly_count`)

Compteur agrégé du nombre **d'articles distincts** évoquant un hashtag, calculé par heure de **publication** en UTC.

| Champ Prisma | Type | Obligatoire | Description |
|---|---|---:|---|
| `hashtagId` | UUID | Oui | Référence `Hashtag` |
| `hourUtc` | DateTime | Oui | Début d'heure en UTC, dérivé d'`Article.publishedAt` |
| `articleCount` | Integer | Oui | Nombre d'articles distincts correspondants |
| `updatedAt` | DateTime | Oui | Dernier recalcul / ajustement |

**Contraintes :** clé composite `(hashtagId, hourUtc)`, compteur non négatif, index chronologique. Suppression en cascade des compteurs lors de la suppression d'un hashtag. **Aucune table `article_hashtag` persistante** pour le MVP.

## 14.4. Règles de cohérence des tendances

- Un article compte **au plus une fois par hashtag**, même si plusieurs variantes apparaissent dans le titre et le résumé.
- La recherche porte sur `Article.title` et `Article.summary` ; la page de détail recherche les articles conservés, toutes langues confondues, par date de publication décroissante avec pagination.
- La création/modification des alias, la suppression d'articles, les réimportations et les corrections de contenu doivent déclencher une **reconstruction des heures affectées**, ou un recalcul borné, pour éviter la dérive des compteurs sans table d'association.
- Les classements 24 h / 7 j / 30 j sont dérivés des heures conservées ; un automate peut matérialiser/mettre en cache le classement public chaque heure.
- La purge des articles (`retentionArticlesDays`) et des compteurs (`retentionHashtagHourlyCountsDays`) est cohérente ; un changement de durée peut nécessiter une reconstruction. Il n'est pas possible de recréer des statistiques plus anciennes que les articles déjà purgés.
- Les statistiques sont indicatives et reflètent les articles **actuellement présents** en base, non l'historique complet de l'actualité.

## 14.5. Règles fonctionnelles du MVP — proposition pour validation

Ces règles précisent la conception du MVP avant création des Stories Jira. Elles restent modifiables lors de la validation fonctionnelle ; les choix numériques sont des **valeurs initiales proposées**, non des performances garanties.

### Périmètre des mentions

1. Seuls les **articles d'actualité enregistrés** dans `Article` sont pris en compte, jamais les vidéos YouTube, les descriptions de sources ni le contenu intégral des pages externes.
2. Un article est une unité de comptage : une mention au moins dans `title` ou `summary` compte **1** pour le hashtag concerné. Répétitions dans le titre/résumé et correspondance de plusieurs alias du même hashtag ne multiplient pas ce nombre.
3. Les articles de **toutes les langues** et de **toutes les sources** sont pris en compte ; aucun filtre de langue de l'interface ne modifie le classement. Deux articles distincts sur le même événement sont comptés séparément, sauf s'ils ont été dédupliqués dans la table `Article`.
4. Seuls les articles dont `publishedAt` est dans la fenêtre analysée et non dans le futur y contribuent. Les flux inactifs n'entraînent pas une suppression rétroactive des articles déjà conservés. Les hashtags désactivés ne sont pas publiés.
5. La définition d'un sujet repose sur **son nom principal + ses alias saisis manuellement**. Pas de traduction automatique, d'extraction de nouveaux sujets ni de désambiguïsation sémantique par IA dans le MVP.

### Correspondance multilingue et termes ambigus

- Normaliser Unicode, espaces, casse et accents latins pour les comparaisons ; traiter les mots entiers et les séquences de mots, en évitant les simples inclusions de sous-chaînes (« Rome » ne doit pas trouver « promenade »).
- Les variantes translittérées ou dans une autre écriture (ex. `Moscow` / `Москва`) exigent un **alias explicite**. Aucun rapprochement phonétique ni synonymie automatiques.
- Un alias pouvant avoir plusieurs sens (ex. « Orange ») ne permet pas de déterminer l'intention de l'article : afficher un **avertissement dans l'administration** pour les termes courts/ambigus et permettre à l'administrateur d'affiner ou de retirer les alias. Le moteur MVP fait une correspondance lexicale, pas une classification sémantique.
- Un même alias normalisé sur plusieurs hashtags déclenche un avertissement de recouvrement, sans bloquer par défaut. Un article peut compter pour deux sujets distincts s'il correspond à chacun de leurs définitions.
- Les termes vides, doublons normalisés **au sein du même hashtag** et alias ne contenant pas de caractères utiles sont refusés.

### Fenêtres d'analyse et classement

- Le rafraîchissement des classements est **horaire**. À l'instant `T` (dernière heure UTC complète), les périodes sont les intervalles semi-ouverts : 24 h `[T-24h, T)`, 7 j `[T-7j, T)`, 30 j `[T-30j, T)`. `T` et la date de dernière mise à jour sont affichés au public.
- Pour une période `P`, la comparaison est effectuée avec la **période précédente de même durée** : `[T-2P, T-P)`. Les fenêtres sont communes à tous les hashtags, sans avantage lié à la date de création d'un sujet. Lorsqu'un nouveau hashtag est créé, un backfill sur les articles conservés alimente les fenêtres disponibles.
- **« Plus cités »** : classement décroissant par nombre d'articles de la fenêtre, à partir de 1 mention ; départager par nom puis slug.
- **« Tendances »** : les seuils sont administrables dans `Setting` (scope `GLOBAL`, type `INTEGER`) : `hashtagTrendMinMentions` (valeur initiale `10`, minimum de mentions courantes), `hashtagTrendMinIncrease` (valeur initiale `5`, minimum de mentions supplémentaires) et `hashtagTrendScoreFloor` (valeur initiale `5`, plancher de dénominateur). Un hashtag est éligible si `Nactuel >= hashtagTrendMinMentions` ET `Nactuel - Nprécédent >= hashtagTrendMinIncrease`. Score = `(Nactuel - Nprécédent) / max(Nprécédent, hashtagTrendScoreFloor)`. Tri par score décroissant, puis nombre de mentions décroissant, puis slug croissant. Ces seuils s'appliquent aux trois périodes (24 h, 7 j, 30 j) et ne sont pas codés en dur.
- **Variation affichée** : lorsque le dénominateur précédent est strictement positif, `100 × (Nactuel - Nprécédent) / Nprécédent`, arrondie à l'entier ; lorsque `Nprécédent = 0` et `Nactuel > 0`, afficher **« Nouveau »** au lieu d'un pourcentage infini. Une absence de données précédentes (historique insuffisant) affiche **« — »**, jamais `+∞ %`.
- Si la rétention disponible est trop courte pour la fenêtre courante **et sa période précédente**, la progression et le mode « Tendances » pour cette durée sont indisponibles. Pour une comparaison 30 j / 30 j, il faut donc **60 jours réellement disponibles**. Le classement « Plus cités » peut toujours porter sur les seules données disponibles, avec une mention explicite de leur couverture.
- Les compteurs horaires reflètent **les heures closes** ; les nouveaux articles reçus dans l'heure en cours peuvent déjà figurer sur la page détaillée, mais ne figurent dans le classement qu'à la mise à jour suivante. Le nombre affiché sur le classement ne doit pas être présenté comme un total historique des 60 jours.

### Paramètres de détection des tendances (cible MVP)

Ces lignes de `Setting` sont de portée `GLOBAL` (`scopeId = NULL`) et de type `INTEGER` ; elles sont administrables depuis une rubrique « Paramètres des tendances » et initialisées par un script SQL idempotent.

| `Setting.key` | Défaut | Validation |
|---|---:|---|
| `hashtagTrendMinMentions` | 10 | entier >= 1 |
| `hashtagTrendMinIncrease` | 5 | entier >= 1 |
| `hashtagTrendScoreFloor` | 5 | entier >= 1 |

Les trois valeurs sont **communes aux périodes** 24 h, 7 j et 30 j. L'enregistrement par un administrateur exige une validation côté NestJS, et la modification invalide le cache des classements ; les compteurs horaires bruts `HashtagHourlyCount` n'ont pas à être recalculés du seul fait d'un changement de seuil. Les nouvelles valeurs s'appliquent à la prochaine génération des classements ; l'administration peut proposer une actualisation immédiate contrôlée.

## 14.6. Parcours publics et administration — MVP

- Routes publiques prévues : `/[locale]/hashtags` (classement) et `/[locale]/hashtags/[slug]` (détail). La langue de l'URL traduit l'interface, **pas** les articles de la page de hashtag.
- Le classement présente les sujets actifs avec image de couverture (fallback en l'absence d'image), nom, mentions sur la période, progression ou « Nouveau »/« — », sélection 24 h / 7 j / 30 j et tri « Plus cités » / « Tendances ». Les liens de l'image et du nom ouvrent la page détail, pas un site externe.
- La page détail reprend la présentation des pages catégories : « À la Une + grille », puis grille 3×2 et grille compacte 4×2 en alternance ; articles paginés, tri `publishedAt DESC, id DESC`, drapeaux et ouverture de l'article original dans un nouvel onglet. Recherche sur le nom et tous les alias, toutes langues.
- L'administration propose CRUD / activation des hashtags, gestion des alias, upload d'image et import contrôlé d'image par URL, ouverture de recherches Google Images / Wikimedia Commons dans un nouvel onglet. Ne jamais télécharger automatiquement une image depuis Google Images ni présumer de son droit de réutilisation.
- L'image est conservée hors PostgreSQL, sur un stockage **persistant** sauvegardé avec l'application, convertie en WebP ; la base contient uniquement `imageUrl`. Les suppressions et remplacements d'images doivent retirer les fichiers devenus orphelins après confirmation de l'opération.
- En cas de suppression, de modification d'un alias, d'un article ou d'un hashtag, les compteurs concernés sont reconstruits/reconciliés afin de ne pas conserver d'anciens résultats. L'historique horaire est limité aux articles effectivement disponibles : **aucune statistique ne doit survivre comme si un article purgé était encore consultable**.


# 15. Durées de conservation indépendantes — modèle cible

La table `Setting` existante porte les huit durées décrites en section 8. Les nettoyages sont des traitements applicatifs séparés, planifiés, idempotents et observables :

- `Article` et `Video` : date `publishedAt`, au-delà de leur propre durée.
- `FeedRun` et `FeedVideoRun` : date `startedAt`, avec traitement prudent des runs encore `RUNNING`.
- `HashtagHourlyCount` : `hourUtc`, en cohérence avec la rétention des articles.
- Logs Pino conservés dans des fichiers : politique de rotation/purge par service, si le stockage local est sous contrôle de LMN24.
- Les statuts `lastFetch*` sur les flux demeurent des **états courants**, pas des historiques à purger.

Les données supprimées ne deviennent pas récupérables par la simple augmentation d'une durée. La purge réelle sera développée via User Stories Jira, avec journal de synthèse et tests. Les sauvegardes PostgreSQL suivent une rétention séparée de l'application.

