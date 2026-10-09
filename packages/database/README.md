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
