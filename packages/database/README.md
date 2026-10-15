# @lmn24/database

Shared database package for LMN24.

## Responsibilities

- Prisma schema
- Prisma configuration
- generated Prisma Client
- shared PostgreSQL access for the backend and parser
- Prisma migrations

## Local configuration

Copy `.env.example` to `.env` and configure `DATABASE_URL`.

## Commands

```bash
pnpm prisma:validate
pnpm prisma:format
pnpm prisma:generate
pnpm prisma:migrate:dev
pnpm prisma:migrate:deploy
pnpm prisma:studio
```

All Prisma migrations must be created and managed from this package.


## SCRUM-25 — Migration des catégories de la page d'accueil

**Important :** le dépôt LMN24 utilise actuellement des scripts SQL historiques
(`database/schema.sql`, puis `database/migrations/001...006`). Le dossier
`packages/database/migrations` ne dispose **pas encore d'historique Prisma
Migrate initialisé et baseliné**. Pour une base existante issue de ces scripts,
il faut exécuter **uniquement** la migration SQL 006 avec `psql` ; ne lancez
pas `prisma migrate dev` ou `prisma migrate deploy` sur cette base sans
avoir auparavant établi une baseline Prisma du schéma déjà déployé.

1. Sauvegarder la base PostgreSQL avant toute migration.
2. Vérifier que les migrations historiques 001 à 005 ont été traitées.
3. Depuis la racine du dépôt, exécuter (en adaptant la chaîne de connexion) :

```powershell
psql -v ON_ERROR_STOP=1 -d "postgresql://USER:PASSWORD@localhost:5432/lmn24" -f database/migrations/006_category_home_display.sql
```

4. Régénérer le client Prisma puis vérifier le schéma :

```powershell
pnpm db:validate
pnpm db:generate
```

La migration 006 :
- conserve les catégories, sources, flux et articles existants ;
- initialise les positions par `slug` alphabétique, avec positions de 1 à N ;
- initialise les layouts à `GRID` et les couleurs à `#2563EB` ;
- applique les contraintes de format et d'unicité.

Pour une **nouvelle base uniquement**, utiliser `database/schema.sql`,
puis les scripts de peuplement (dont `database/seed_category.sql`).
Le schéma bootstrap contient déjà ces champs : **ne pas exécuter la migration
006 sur une nouvelle base si elle n'est pas nécessaire**.

Le script `database/seed_category.sql` est réexécutable et conserve l'ordre,
la couleur et la mise en page des catégories existantes. En cas d'ajout d'une
catégorie par une future API, réserver `MAX(display_order)+1` sous le même
verrou de transaction PostgreSQL `pg_advisory_xact_lock(241024, 1)`.

> La configuration de la page d'accueil réside dans `Category`. La capacité
> d'articles est déterminée par `layoutType`, et non par une valeur `Setting`.

## SCRUM-48 — Modèle Hashtags (migration SQL 008)

Trois modèles sont ajoutés dans `schema.prisma` : `Hashtag`,
`HashtagAlias` et `HashtagHourlyCount`. Ils ne créent **aucune**
association `ArticleHashtag` ; l'image d'un hashtag reste un chemin vers un
fichier, jamais un binaire en base.

### Base existante (installation historique LMN24)

**Ne lancez pas `prisma migrate dev` / `prisma migrate deploy`** sur une base
préexistante non baselinée. Le dossier Prisma Migrate n'est pas initialisé :
la migration est fournie explicitement dans
`database/migrations/008_hashtag_data_model.sql`, comme les scripts historiques.

1. Sauvegarder PostgreSQL et vérifier que les tables historiques de LMN24 sont présentes.
2. Depuis la racine du monorepo sous PowerShell, appliquer **une seule fois** :

```powershell
psql -v ON_ERROR_STOP=1 -d "postgresql://USER:PASSWORD@localhost:5432/lmn24" -f database/migrations/008_hashtag_data_model.sql
```

3. Tester les contraintes sans conserver les lignes de test (transaction avec `ROLLBACK`) :

```powershell
psql -v ON_ERROR_STOP=1 -d "postgresql://USER:PASSWORD@localhost:5432/lmn24" -f database/tests/scrum_48_hashtag_schema_smoke.sql
pnpm db:validate
pnpm db:generate
```

4. Vérifier la présence de `hashtag`, `hashtag_alias` et
   `hashtag_hourly_count` dans Prisma Studio.

### Base neuve

`database/schema.sql` inclut déjà ces trois tables : **ne pas exécuter la
migration 008 après ce bootstrap**, car les tables existent. Les autres
extensions du schéma LMN24 (notamment les vidéos) conservent leurs propres
procédures de création/migration.

### Contraintes et limites

- `Hashtag.slug` est unique, en minuscules avec traits d'union.
- `HashtagAlias.normalizedName` (stocké `normalized_name`) est **obligatoire**,
  et unique avec `hashtagId`. Il sera calculé par un même helper de normalisation
  dans le backend/parser (NFKC, casse, accents latins, espaces) lors de SCRUM-49/51.
  La contrainte empêche les écritures concurrentes de clés équivalentes ;
  l'API doit aussi refuser un alias équivalent au nom principal du hashtag.
- `HashtagHourlyCount` a une clé primaire composite (`hashtagId`, `hourUtc`),
  un compteur non négatif et une contrainte d'alignement de l'heure UTC.
- Suppression d'un hashtag : cascade uniquement vers ses alias et ses compteurs,
  jamais vers les articles.
- Les index sur `hour_utc` servent à la purge ; l'index unique composite des
  alias couvre déjà la recherche par `hashtag_id` (pas d'index redondant).
- La création de schéma ne remplit pas les compteurs ; l'ingestion et le
  recalcul appartiennent aux Stories SCRUM-51/52.
- Aucun script n'a été exécuté sur la base PostgreSQL locale lors de ce changement.


## SCRUM-69 — Météo mondiale : 66 villes et modèles de données

L'extension Météo ajoute **trois tables** : `weather_city` (référentiel),
`weather_current` (une observation courante par ville, facultative) et
`weather_run` (exécutions futures du parser). Les champs et contraintes sont
déclarés dans `schema.prisma` et dans une migration SQL additive.

### Mise à jour d'une base existante LMN24 (Windows / PowerShell)

**1. Sauvegarder la base `lmn24`**, vérifier son état et arrêter les
traitements capables de modifier les données pendant la migration.

**2. Depuis la racine du dépôt, appliquer la migration SQL historique :**

```powershell
# Adapter le compte, le port et le chemin de psql à ton poste.
psql -v ON_ERROR_STOP=1 -U postgres -d lmn24 -f database/migrations/011_weather_data_model.sql
```

La migration est transactionnelle, additive et réexécutable. Elle reconnaît
la table `weather_city` si le fichier initial
`lmn24_weather_city_66.sql` a déjà été exécuté.
Ne **pas** exécuter à la fois `database/migrations/011_weather_data_model.sql`
et `packages/database/migrations/20261015223000_weather_data_model/migration.sql`
sur la même base : ce sont deux chemins vers une migration équivalente.
**Ne pas lancer `prisma migrate dev` ou `prisma migrate deploy`** sur une
base LMN24 historique non baselinée : les anciennes migrations sont des SQL
hors de l'historique Prisma Migrate.

**3. Initialiser les données de référence et paramètres (une seule fois ou
plusieurs fois, les scripts conservent les modifications existantes) :**

```powershell
psql -v ON_ERROR_STOP=1 -U postgres -d lmn24 -f database/seed_weather_cities.sql
psql -v ON_ERROR_STOP=1 -U postgres -d lmn24 -f database/seed_weather_settings.sql
```

Le seed de villes crée au maximum les **66 valeurs initiales**, distribuées
EU 15, AS 15, AF 12, NA 12, SA 6, OC 6. Il ne modifie ni ne supprime
les villes existantes, et échoue de manière transactionnelle si une collision
d'ordre empêche de retrouver les 66 villes prévues.

**4. Vérifier puis régénérer le client Prisma :**

```powershell
psql -v ON_ERROR_STOP=1 -U postgres -d lmn24 -f database/tests/scrum_69_weather_schema_smoke.sql
pnpm db:validate
pnpm db:generate
```

Le test SQL est encapsulé dans une transaction **ROLLBACK** : aucune ligne
de test n'est conservée. Consulter au besoin les trois tables dans Prisma
Studio après la génération du client.

### Limites et suite

- Aucun appel météo, lancement du parser, formulaire d'administration ou page
  publique n'est livré par SCRUM-69 : ces composants sont suivis dans
  SCRUM-70 à SCRUM-79.
- Le paramètre `weatherCurrentRefreshMinutes=60` est **indicatif** :
  l'automatisation CRON ne sera activable qu'avec SCRUM-80.
- `weatherStaleAfterMinutes=180` et `weatherRunRetentionDays=14`
  ne déclenchent aucune purge. La purge administrative sera ajoutée
  dans SCRUM-78.
- La table `weather_city` n'a pas de FK `country_iso2` vers `country` :
  certains codes pays de la sélection peuvent être absents du référentiel
  historique. Toute FK future exige un audit préalable.
- Le seed fournit des coordonnées de centre-ville ; elles restent modifiables
  depuis la future interface de gestion des villes.
