# ARCHITECTURE.md

## 1. Objectif

Ce document définit l’architecture technique de référence du projet **LMN24**.

LMN24 est un agrégateur d’actualités multilingue alimenté par des flux RSS/XML provenant de médias internationaux. Le système est composé de trois applications distinctes réunies dans un même monorepo :

- un **frontend public et d’administration** en Next.js ;
- un **backend API** en NestJS ;
- un **parser RSS/XML indépendant** en Node.js / TypeScript.

Ce document doit rester détaillé mais pragmatique. Il décrit les choix techniques, les responsabilités de chaque composant, les règles de communication entre composants, les conventions de développement et les principes de sécurité, de qualité et d’exploitation.

Les règles fonctionnelles détaillées, parcours utilisateurs et critères d’acceptation doivent être définis dans Jira.

---

## 2. Documents de référence

Tout code généré ou modifié pour LMN24 doit respecter :

1. **ARCHITECTURE.md** : architecture et règles techniques ;
2. **docs/DATA_MODEL.md** : modèle de données fonctionnel ;
3. **Jira** : exigences fonctionnelles, User Stories, règles métier et critères d’acceptation.

En cas de contradiction entre ces sources, la contradiction doit être résolue avant implémentation.

---

## 3. Principes d’architecture

LMN24 repose sur les principes suivants :

- séparation nette entre frontend, backend et parser ;
- un seul dépôt GitHub pour l’ensemble du système ;
- TypeScript sur les trois applications ;
- PostgreSQL comme base de données unique ;
- Prisma comme couche d’accès à PostgreSQL ;
- REST pour les échanges frontend/backend ;
- accès direct du parser à PostgreSQL via Prisma ;
- composants faiblement couplés ;
- configuration fonctionnelle centralisée dans la table `Setting` ;
- secrets et paramètres techniques d’infrastructure dans les variables d’environnement ;
- architecture simple pour le MVP, mais extensible ;
- aucune dépendance à Docker pour le MVP ;
- hébergement volontairement non imposé à ce stade.

---

## 4. Organisation du monorepo

LMN24 utilise :

- **pnpm workspaces** pour la gestion du monorepo et des dépendances ;
- **Turborepo** pour orchestrer les tâches communes : build, test, lint et cache de build ;
- une version **Node.js LTS commune** définie à la racine du dépôt.

Arborescence cible :

```text
lmn24/
├── apps/
│   ├── frontend/
│   ├── backend/
│   └── parser/
│
├── packages/
│   ├── database/
│   ├── contracts/
│   ├── config/
│   └── eslint-config/
│
├── messages/
│   ├── fr.json
│   ├── en.json
│   ├── de.json
│   ├── es.json
│   ├── pt.json
│   ├── it.json
│   └── ru.json
│
├── database/
│   ├── schema.sql
│   ├── migrations/
│   └── seed_*.sql
│
├── docs/
│   └── DATA_MODEL.md
│
├── ARCHITECTURE.md
├── README.md
├── pnpm-workspace.yaml
├── turbo.json
└── .env.example
```

### 4.1 Applications

- `apps/frontend` : site public + administration ;
- `apps/backend` : API REST, authentification, règles applicatives et administration ;
- `apps/parser` : récupération, parsing et ingestion des flux RSS/XML.

### 4.2 Packages partagés

#### `packages/database`

Contient :

- le schéma Prisma ;
- le client Prisma partagé ;
- les migrations Prisma ;
- les seeds Prisma futurs ;
- les utilitaires communs d’accès à la base.

Il constitue l’unique point autorisé à créer et gérer les migrations Prisma.

#### `packages/contracts`

Contient :

- les schémas Zod partagés ;
- les types des contrats API ;
- les DTO/types communs entre frontend, backend et parser lorsqu’ils sont réellement partagés.

#### `packages/config`

Contient les éléments de configuration technique partagés qui ne sont ni secrets ni spécifiques à un seul service.

#### `packages/eslint-config`

Contient les règles ESLint communes au monorepo.

---

## 5. Stack technique

### 5.1 Frontend

- Next.js, version stable la plus récente au moment de l’initialisation ou de la montée de version ;
- React ;
- TypeScript strict ;
- **App Router** ;
- Bootstrap ;
- React-Bootstrap ;
- next-intl ;
- TanStack Query ;
- React Hook Form ;
- Zod ;
- Vitest ;
- Playwright.

### 5.2 Backend

- NestJS ;
- TypeScript strict ;
- Prisma ;
- PostgreSQL ;
- Zod pour les validations partagées lorsque pertinent ;
- Swagger / OpenAPI ;
- Pino pour les logs structurés ;
- cache mémoire NestJS pour le MVP ;
- bcrypt pour le hash et la vérification des mots de passe ;
- Nodemailer pour les capacités SMTP ;
- Vitest.

### 5.3 Parser

- Node.js ;
- TypeScript strict ;
- Prisma ;
- PostgreSQL ;
- `rss-parser` pour RSS/Atom ;
- parser XML plus bas niveau autorisé lorsque nécessaire pour des flux particuliers ;
- `node-cron` pour la planification ;
- Pino pour les logs ;
- Vitest.

---

## 6. Architecture logique

```text
                         ┌──────────────────────┐
                         │      Navigateur      │
                         └──────────┬───────────┘
                                    │ HTTPS
                                    ▼
                         ┌──────────────────────┐
                         │  Frontend Next.js    │
                         │  Public + /admin     │
                         └──────────┬───────────┘
                                    │ REST
                                    ▼
                         ┌──────────────────────┐
                         │   Backend NestJS     │
                         │ API / Auth / Admin   │
                         └──────────┬───────────┘
                                    │ Prisma
                                    ▼
                              ┌────────────┐
                              │ PostgreSQL │
                              └─────▲──────┘
                                    │ Prisma
                         ┌──────────┴───────────┐
                         │ Parser RSS/XML       │
                         │ Scheduler + Import   │
                         └──────────▲───────────┘
                                    │
                              HTTP / RSS / XML
                                    │
                         ┌──────────┴───────────┐
                         │ Médias / Journaux    │
                         └──────────────────────┘
```

Le parser expose également une petite API interne permettant au backend de demander un lancement manuel.

---

## 7. Frontend Next.js

### 7.1 Responsabilités

Le frontend est responsable :

- du rendu du site public ;
- de la navigation multilingue ;
- de l’interface d’administration ;
- de l’affichage des données obtenues depuis le backend ;
- de l’expérience utilisateur ;
- du SEO ;
- de l’accessibilité ;
- de la gestion locale de l’état d’interface.

Le frontend **ne doit jamais accéder directement à PostgreSQL**.

Toute donnée applicative provient du backend via l’API REST.

### 7.2 Rendu

Les pages publiques privilégient :

- Server Components ;
- rendu côté serveur lorsque pertinent ;
- JavaScript côté client uniquement pour les composants réellement interactifs.

L’objectif est de favoriser :

- SEO ;
- rapidité du premier affichage ;
- Core Web Vitals ;
- faible quantité de JavaScript client.

### 7.3 Administration

L’administration fait partie du même projet Next.js.

Route racine :

```text
/admin
```

La zone `/admin` est protégée par authentification.

Pour le MVP, l’administration est en **français uniquement**, mais les composants doivent rester compatibles avec une future internationalisation.

### 7.4 CSS et composants

Le frontend utilise :

- Bootstrap comme framework CSS ;
- React-Bootstrap pour les composants React.

Les composants doivent rester réutilisables et éviter les styles inline non justifiés.

### 7.5 Gestion des données distantes

TanStack Query est utilisé pour :

- les requêtes API interactives ;
- les mutations ;
- les états de chargement ;
- les erreurs ;
- l’invalidation du cache client lorsque nécessaire.

Redux n’est pas retenu pour le MVP.

React Context et l’état local suffisent pour les états globaux simples.

### 7.6 Formulaires

Les formulaires utilisent :

- React Hook Form ;
- Zod pour la validation côté frontend.

La validation frontend améliore l’expérience utilisateur mais **ne remplace jamais la validation backend**.

### 7.7 Page d’accueil publique configurable (cible MVP)

La route localisée `/[locale]` présente les actualités par **sections de catégories**, selon la configuration administrée globalement. La conception est décrite dans les Stories Jira `SCRUM-15`, `SCRUM-24`, `SCRUM-25` et `SCRUM-26`.

- L’ordre des sections suit `Category.displayOrder ASC` ; les catégories inactives sont exclues.
- Chaque section utilise **la mise en page** `Category.layoutType` et la **couleur d’accent** `Category.themeColor`. Ces réglages sont communs à toutes les langues.
- Le nombre maximal d’articles affichés est fixé **uniquement par la mise en page** ; l’administrateur ne saisit pas un nombre d’articles séparé et aucun champ de capacité par catégorie n’est persisté.
- Pour chaque catégorie, les articles sont filtrés selon la **langue de l’URL**, puis sélectionnés par `Article.publishedAt DESC` (date de publication, jamais `createdAt`), avec `id DESC` comme départage stable.
- **Si une catégorie ne contient aucun article dans la langue affichée, sa section entière est masquée** ; elle conserve néanmoins son statut et sa configuration en base. Une catégorie possédant moins d’articles que la capacité du modèle affiche uniquement les articles présents, sans faux éléments.
- Si toutes les catégories sont vides pour une langue, afficher un **état global vide** plutôt que des sections sans contenu.
- Les titres de catégorie proviennent de `next-intl` et des slugs. Les liens d’articles ouvrent l’URL de la source dans un nouvel onglet, avec les protections adaptées.
- Les mises en page sont **responsives et accessibles**, notamment le carrousel au clavier ; les couleurs d’accent ne doivent pas réduire les contrastes.
- Ces paramètres de présentation **ne s’appliquent pas aux pages dédiées à une catégorie**, dont le rendu est indépendant.

#### Catalogue des huit mises en page

| Valeur de `layoutType` | Structure desktop | Capacité maximale d’articles |
| --- | --- | ---: |
| `FEATURED` | Un grand article et quatre secondaires | 5 |
| `GRID` | Grille de trois colonnes et deux lignes | 6 |
| `LIST` | Cinq articles en liste verticale | 5 |
| `SPLIT` | Un grand article et deux secondaires | 3 |
| `MOSAIC` | Une grande vignette et quatre petites | 5 |
| `COMPACT` | Grille de quatre colonnes et deux lignes | 8 |
| `HEADLINES` | Dix titres en liste dense | 10 |
| `CAROUSEL` | Six cartes dans un carrousel horizontal accessible | 6 |

Les composants ajustent le nombre de colonnes et leur géométrie à la taille de l’écran **sans changer la capacité maximale** du modèle.

---

## 8. Internationalisation

### 8.1 Langues supportées

Le site public supporte :

- français : `fr` ;
- anglais : `en` ;
- allemand : `de` ;
- espagnol : `es` ;
- portugais : `pt` ;
- italien : `it` ;
- russe : `ru`.

### 8.2 Bibliothèque

Le frontend utilise **next-intl**.

### 8.3 Fichiers de traduction

Les traductions sont stockées sous :

```text
/messages
```

Chaque langue dispose de son propre fichier JSON.

Les fichiers contiennent notamment :

- les libellés d’interface ;
- les pays ;
- les catégories ;
- les langues.

Aucun libellé utilisateur ne doit être codé en dur dans les composants lorsqu’il relève de l’i18n.

### 8.4 URL multilingues

Les pages publiques utilisent le préfixe de langue :

```text
/fr/...
/en/...
/de/...
/es/...
/pt/...
/it/...
/ru/...
```

Exemple :

```text
/fr/sports
/en/sports
```

### 8.5 Langue par défaut

La langue par défaut est **paramétrable** via la table `Setting`.

Valeur initiale :

```text
fr
```

### 8.6 Détection et mémorisation

Lors d’une première visite :

1. le site vérifie la langue du navigateur ;
2. si elle fait partie des langues supportées, elle peut être utilisée ;
3. sinon, la langue par défaut configurée est utilisée.

Le choix explicite du visiteur est mémorisé dans un cookie.

### 8.7 Langue des actualités

Le choix de langue sur le site **filtre également les articles**, et pas seulement les traductions de l’interface :

- `/fr` affiche **uniquement** les articles dont `Article.languageIsoCode2 = fr` ;
- `/en` affiche **uniquement** les articles dont `Article.languageIsoCode2 = en` ;
- même règle pour `de`, `es`, `pt`, `it` et `ru`.

Il n’existe **aucun mélange des langues** ni repli automatique vers les articles d’une autre langue. Une catégorie peut donc être visible sur une version linguistique de l’accueil et absente sur une autre faute d’articles éligibles. L’ordre, la couleur et la mise en page configurés des catégories restent, eux, **globaux**.

---

## 9. Backend NestJS

### 9.1 Responsabilités

Le backend est responsable :

- de l’API REST ;
- de l’authentification ;
- des sessions ;
- des autorisations ;
- des règles applicatives ;
- de la gestion de l’administration ;
- de la lecture et modification des paramètres ;
- de la validation des entrées ;
- de l’accès PostgreSQL pour les besoins du frontend ;
- du déclenchement manuel du parser ;
- de la supervision applicative ;
- de la documentation OpenAPI.

### 9.2 API REST

Le backend expose une API REST.

Pour le MVP :

- aucune version n’est intégrée dans l’URL ;
- l’API est considérée comme interne ;
- son architecture doit permettre d’exposer certaines routes publiquement plus tard.

Le frontend ne communique jamais directement avec le parser.

### 9.3 Swagger / OpenAPI

La documentation de l’API est générée via Swagger/OpenAPI.

Elle doit permettre :

- de consulter les endpoints ;
- de comprendre les contrats ;
- de tester les routes lorsque l’environnement le permet.

### 9.4 Format standard des erreurs

Les erreurs API suivent un format homogène contenant au minimum :

```json
{
  "statusCode": 400,
  "code": "EXAMPLE_CODE",
  "message": "Message lisible",
  "details": {},
  "timestamp": "..."
}
```

Les détails techniques sensibles ne doivent jamais être exposés au client.

### 9.5 Pagination, filtres et tri

Les listes importantes sont paginées côté serveur.

Cela concerne notamment :

- articles ;
- sources ;
- feeds ;
- utilisateurs ;
- logs ;
- exécutions du parser.

L’API doit fournir de façon cohérente :

- pagination ;
- tri ;
- filtres ;
- recherche texte simple lorsque pertinent.

### 9.6 API de configuration et de composition de l’accueil (cible)

Le backend NestJS sert de point d’accès unique à PostgreSQL pour le frontend. Les contrats ci-dessous sont **à implémenter** dans `SCRUM-25` et `SCRUM-26` ; leur description ne signifie pas qu’ils existent déjà dans le code.

| Méthode et endpoint | Rôle | Accès |
| --- | --- | --- |
| `GET /admin/categories` | Liste complète enrichie de `displayOrder`, `layoutType` et `themeColor` | Session administrateur |
| `GET /admin/categories/:id` | Configuration d’une catégorie, même inactive | Session administrateur |
| `PATCH /admin/categories/:id/home-display` | Modification validée de la mise en page et de la couleur | Session administrateur |
| `PUT /admin/categories/home-order` | Réordonnancement complet et atomique, avec gestion des conflits | Session administrateur |
| `GET /public/home/categories` | Métadonnées des catégories actives, dans l’ordre configuré, y compris éventuellement sans article | Public |
| `GET /public/home?locale=fr` | Sections actives **non vides** et articles récents de la langue, déjà limités par le layout | Public |

Les endpoints existants, notamment la modification du statut d’une catégorie, restent compatibles. L’API publique de composition doit appliquer le filtre `languageIsoCode2`, le tri `publishedAt DESC` puis `id DESC`, la capacité du modèle et le masquage des sections vides. Elle doit éviter les lectures non bornées et les requêtes inutiles répétées par catégorie, en exploitant les index de la base.

La mise à jour du classement est transactionnelle et protège l’unicité et la continuité des positions. Les mises à jour des paramètres visuels n’affectent ni `isActive` ni le classement. La modification depuis l’administration doit être reflétée au prochain chargement public sans exposer un cache obsolète ; pendant le MVP, `Cache-Control: no-store` est possible pour ces lectures.

---

## 10. Authentification et autorisation

### 10.1 Mode d’authentification

L’administration utilise :

- email ;
- mot de passe.

### 10.2 Sessions

Le système utilise des **sessions serveur persistantes**.

Les sessions sont stockées dans PostgreSQL.

Le navigateur reçoit uniquement un cookie de session sécurisé.

### 10.3 Cookies

Les cookies d’authentification doivent être :

- HTTP-only ;
- Secure en environnement HTTPS ;
- configurés avec une politique SameSite adaptée ;
- protégés contre les attaques CSRF.

### 10.4 Rôles

Rôles initiaux :

- `ADMIN` ;
- `EDITOR`.

Les permissions détaillées relèvent des User Stories et des règles métier.

### 10.5 Mots de passe

Les mots de passe sont hashés avec **bcrypt**.

Le backend NestJS est la référence applicative pour :

- générer les hashes bcrypt lors de la création ou modification d’un mot de passe ;
- vérifier un mot de passe lors de l’authentification ;
- utiliser un coût bcrypt adapté, avec une valeur cible initiale de **12 rounds**.

Ils ne sont jamais stockés ni journalisés en clair.

La colonne PostgreSQL `app_user.password_hash` contient uniquement le hash bcrypt.

Pour les besoins de bootstrap ou de test local, PostgreSQL peut générer un hash bcrypt compatible via l’extension `pgcrypto`, par exemple :

```sql
crypt('mot_de_passe', gen_salt('bf', 12))
```

Cette possibilité est réservée aux opérations de bootstrap/test et ne remplace pas la logique d’authentification du backend.

Politique minimale pour les comptes créés via l’application :

- 12 caractères ;
- au moins une majuscule ;
- au moins une minuscule ;
- au moins un chiffre ;
- au moins un caractère spécial.

La règle est validée côté frontend pour l’UX et obligatoirement côté backend pour la sécurité.

Les comptes de test locaux peuvent utiliser des identifiants simplifiés lorsqu’ils sont explicitement créés pour le développement et ne sont jamais utilisés hors environnement local.

### 10.6 Email

Le backend peut envoyer des emails via :

- Nodemailer ;
- un serveur SMTP configurable par variables d’environnement.

Les workflows fonctionnels liés aux emails sont décrits dans Jira.

---

## 11. Parser RSS/XML

### 11.1 Positionnement

Le parser est une application indépendante :

```text
apps/parser
```

Il n’est ni intégré au frontend ni au backend.

### 11.2 Accès aux données

Le parser écrit directement dans PostgreSQL via Prisma.

Il utilise le même schéma Prisma que le backend grâce au package partagé :

```text
packages/database
```

Le frontend n’accède jamais au parser.

### 11.3 Parsing

Le parser utilise en priorité `rss-parser`.

Un parseur XML plus bas niveau peut être utilisé pour :

- des extensions RSS particulières ;
- des namespaces spécifiques ;
- des flux non standards ;
- des champs non reconnus par `rss-parser`.

La normalisation doit produire un modèle interne cohérent avant écriture en base.

### 11.4 Planification

Les imports automatiques sont planifiés avec `node-cron`.

La fréquence n’est pas codée en dur.

Elle est paramétrable dans l’administration et stockée dans `Setting`.

### 11.5 Déclenchement manuel

L’administration doit pouvoir demander :

- le lancement de tous les feeds ;
- le lancement d’un feed précis.

Le flux est :

```text
Frontend /admin
    ↓
Backend NestJS
    ↓
API interne Parser
    ↓
Exécution
```

### 11.6 Sécurité de l’API du parser

L’API interne du parser :

- n’est jamais appelée directement par le navigateur ;
- est réservée au backend ;
- utilise une clé secrète partagée backend/parser ;
- charge cette clé depuis les variables d’environnement.

### 11.7 Timeout

Le délai maximal de récupération/parsing d’un feed est paramétrable.

Le modèle doit permettre :

- une valeur globale ;
- une surcharge spécifique par feed lorsqu’elle est définie.

### 11.8 Gestion des erreurs

Lorsqu’un feed échoue :

1. l’erreur est journalisée ;
2. le statut du feed est mis à jour ;
3. les autres feeds continuent à être traités ;
4. le parser applique la politique de retry configurée.

### 11.9 Retry

Le nombre de nouvelles tentatives après échec est paramétrable depuis l’administration.

Aucune valeur métier de retry ne doit être codée en dur.

### 11.10 Concurrence

Le nombre maximal de feeds traités simultanément est paramétrable dans l’administration.

Le parser doit respecter cette limite afin de ne pas saturer :

- les médias distants ;
- PostgreSQL ;
- les ressources CPU/mémoire.

### 11.11 Protection contre les cycles simultanés

Pour le MVP, le parser fonctionne avec une seule instance.

Un verrou **en mémoire du processus parser** empêche deux cycles globaux de démarrer simultanément.

Aucun verrou PostgreSQL n’est utilisé pour ce besoin dans le MVP.

Si LMN24 évolue vers plusieurs instances du parser, cette stratégie devra être revue.

### 11.12 Détection des doublons

`articleUrl` est la clé fonctionnelle principale utilisée pour empêcher le double import d’un même article.

La contrainte d’unicité en base reste la protection finale.

### 11.13 Images

Le parser stocke uniquement l’URL distante de l’image fournie par le flux.

Il ne télécharge pas les images sur l’infrastructure LMN24.

### 11.14 Historique d’exécution

Chaque exécution de feed doit pouvoir être historisée via un modèle `FeedRun`.

Il doit permettre de tracer au minimum :

- date/heure de début ;
- date/heure de fin ou durée ;
- statut ;
- feed concerné ;
- nombre d’éléments trouvés ;
- nombre d’articles importés ;
- nombre d’articles ignorés ou déjà présents ;
- erreur éventuelle.

Le détail exact du modèle doit être synchronisé avec `DATA_MODEL.md`.

---

## 12. Nettoyage des contenus et politique de rétention

### 12.1. Principes

Les contenus sont des données temporaires d'agrégation. Les durées sont **indépendantes par famille** et configurables depuis l'administration via des clés `Setting` globales de type `INTEGER` (valeurs positives, en jours). La conservation par défaut des articles devient **60 jours**, en remplacement de l'ancienne valeur de 3 jours. La conservation des vidéos est distincte ; la rétention des logs et des compteurs de hashtags ne se confond pas avec celle des contenus.

Clés de référence : `retentionArticlesDays`, `retentionVideosDays`, `retentionInfoParserRunsDays`, `retentionVideoParserRunsDays`, `retentionInfoParserLogsDays`, `retentionVideoParserLogsDays`, `retentionBackendLogsDays`, `retentionHashtagHourlyCountsDays`. Défauts, types et périmètres sont décrits dans `docs/DATA_MODEL.md` §8 et `database/seed_retention_settings.sql`.

### 12.2. Dates de référence

- Articles : `Article.publishedAt`, et non la date d'import `createdAt`.
- Vidéos : `Video.publishedAt`, et non `createdAt`.
- Historiques du parser infos et du parser vidéo : `FeedRun.startedAt` et `FeedVideoRun.startedAt`, sans suppression prématurée d'une exécution `RUNNING`.
- Compteurs horaires hashtags : `HashtagHourlyCount.hourUtc`, en UTC, bornés par la période pendant laquelle les articles demeurent disponibles.
- Journaux techniques Pino : dates des fichiers, **uniquement** si le service gère effectivement leur stockage local. Pour stdout ou les systèmes de logs de l'hébergeur, une politique de rétention externe est indispensable.

### 12.3. Exécution et fiabilité

Un **module de maintenance planifié dédié**, indépendant des cycles d'extraction RSS/YouTube mais hébergé dans l'application `apps/parser` pour le MVP, lit périodiquement les paramètres via Prisma. Prévoir une exécution quotidienne (heure effective paramétrée par l'ordonnanceur), une seule exécution active grâce à une protection de concurrence, des suppressions **par lots** et un récapitulatif (quantités purgées, durée, erreurs). Le parser continue à fonctionner en cas d'échec d'une purge.

Les paramètres ne produisent **aucune suppression par leur seul enregistrement** : le code de maintenance et les migrations nécessaires doivent être développés, validés et déployés. Il est possible de supprimer physiquement les lignes expirées, y compris les articles supprimés manuellement. Un changement de rétention n'est pas rétroactif : il ne restaure pas les données détruites. La cohérence avec les compteurs de hashtags doit être assurée avant/après les purges ; les compteurs concernés sont recalculés ou expirés, jamais laissés obsolètes.

L'API d'administration refuse les nombres négatifs, zéro, valeurs non entières et durées incohérentes avec les périodes publiques des tendances. L'interface affiche les unités en jours, les valeurs courantes et un avertissement sur l'irréversibilité des purges. L'activation du job nécessite tests de sécurité et de performance, ainsi qu'une gestion documentée de VACUUM et des sauvegardes PostgreSQL.

---

## 13. PostgreSQL et Prisma

### 13.1 Base de données

PostgreSQL est la base de données unique du système.

### 13.2 ORM

Prisma est utilisé par :

- le backend ;
- le parser.

Les deux consomment le même package `packages/database`.

### 13.3 Convention de nommage

PostgreSQL utilise `snake_case` :

```text
source_id
created_at
is_active
```

TypeScript et Prisma exposent `camelCase` :

```text
sourceId
createdAt
isActive
```

Prisma réalise la correspondance.

### 13.4 Source de vérité technique

À terme :

- `DATA_MODEL.md` = référence fonctionnelle du modèle ;
- `schema.prisma` = référence technique exécutable du modèle ;
- Prisma Migrate = mécanisme normal d’évolution de la base.

Le fichier `database/schema.sql` reste utile pour :

- bootstrap initial ;
- référence SQL ;
- compatibilité avec la phase de démarrage du projet.

Une fois Prisma adopté, il ne doit plus être considéré comme le mécanisme principal d’évolution manuelle du schéma.

### 13.5 Migrations

Toutes les migrations Prisma sont créées et exécutées depuis :

```text
packages/database
```

Ni le backend ni le parser ne doivent posséder leur propre historique de migrations indépendant.

L’évolution prévue pour l’accueil (SCRUM-25) requiert une **migration additive non destructive** de `category` et la mise à jour coordonnée de `packages/database/schema.prisma` et `database/schema.sql`. Les catégories existantes recevront une position initiale déterministe, `GRID` et `#2563EB`, sans altérer les articles, les flux ni les clés étrangères. **La présente documentation décrit la cible, et non une migration déjà appliquée.**

---

## 14. Règles de données de référence

### 14.1 Country

Les données techniques du pays sont en base.

Les noms traduits sont dans les fichiers JSON et référencés via `isoCode2`.

### 14.2 Language

La langue utilise son code ISO 639-1 sur deux caractères comme clé technique.

Exemples :

```text
fr
en
de
es
pt
it
ru
```

### 14.3 Category

Les catégories utilisent un `slug` technique stable. Les libellés traduits résident dans `/messages/*.json` et ne sont pas enregistrés dans la table `category`.

Chaque catégorie porte trois paramètres propres à l’**affichage de sa section sur la page d’accueil** :

- `display_order` (Prisma : `displayOrder`), entier positif unique, position globale de 1 à N, y compris pour les catégories inactives ;
- `layout_type` (Prisma : `layoutType`), enum parmi les huit mises en page documentées en section 7.7, valeur par défaut `GRID` ;
- `theme_color` (Prisma : `themeColor`), couleur hexadécimale `#RRGGBB`, valeur par défaut `#2563EB`.

Pour les données déjà présentes, l’ordre initial est construit à partir des `slug` alphabétiques. La configuration est commune à toutes les langues. Une catégorie inactive conserve ses réglages mais est exclue de l’accueil ; une catégorie active sans article dans la langue courante n’y est pas rendue.

Ces champs appartiennent à `Category` et non à `Setting`. Ils **ne modifient pas** les pages dédiées à chaque catégorie, les relations `Article`/`Feed` ou l’ordre des articles.

### 14.4 Article

Un article doit être directement relié à :

- sa source ;
- sa catégorie ;
- sa langue.

Le modèle technique Prisma doit donc exposer la langue de l’article via son code ISO.

### 14.5 Suppression logique

Pour les référentiels et objets structurants, la désactivation est privilégiée à la suppression physique :

- Country ;
- Language ;
- Category ;
- Source ;
- Feed.

Le champ `isActive` est utilisé.

Les articles font exception et peuvent être supprimés physiquement.

---

## 15. Configuration fonctionnelle

La table `Setting` est la source centrale pour les paramètres fonctionnels **transversaux** modifiables depuis l’administration. **Exception :** la configuration visuelle et le classement de la page d’accueil sont des propriétés métier de chaque `Category` (`displayOrder`, `layoutType`, `themeColor`), et non des entrées `Setting`.

Elle doit notamment pouvoir gérer :

- langue par défaut ;
- fréquence automatique du parser ;
- timeout global d’un feed ;
- timeout spécifique d’un feed ;
- nombre de retries ;
- concurrence maximale du parser ;
- durées de conservation **distinctes** des articles, vidéos, historiques d'exécution des parsers infos/vidéos, logs techniques et agrégats horaires de hashtags (voir §12) ;
- durée du cache backend ;
- autres paramètres métier futurs.

Un paramètre spécifique peut surcharger une valeur globale lorsque le modèle `Setting` le permet.

**Le nombre d’articles affichés par section sur la page d’accueil est calculé exclusivement à partir de `layoutType`**, selon le catalogue de la section 7.7 : aucun paramètre indépendant de quantité n’est stocké dans `Setting` ni dans `Category`.

Les paramètres nécessaires **avant le démarrage d’un processus** ne doivent pas dépendre de `Setting`.

---

## 16. Variables d’environnement

Les informations sensibles ou liées au démarrage sont gérées par variables d’environnement.

Exemples :

- URL PostgreSQL ;
- identifiants PostgreSQL ;
- secret de session ;
- secret backend/parser ;
- configuration SMTP ;
- origines CORS ;
- ports ;
- URL backend ;
- URL parser.

Aucun secret ne doit être commité dans GitHub.

### 16.1 Fichiers

Le dépôt doit fournir des fichiers `.env.example` sans secrets.

Ils doivent documenter les variables nécessaires.

### 16.2 Ports locaux par défaut

Valeurs recommandées :

```text
Frontend Next.js : 3000
Backend NestJS   : 3001
Parser           : 3002
PostgreSQL       : 5432
```

Ces valeurs sont modifiables via variables d’environnement.

Elles ne sont pas gérées par l’administration, car elles sont nécessaires avant que les services ne démarrent.

---

## 17. Cache

Pour le MVP, le backend utilise un cache **en mémoire**.

Redis n’est pas nécessaire à ce stade.

La durée du cache est paramétrable via le backend et la table `Setting`.

Cette solution est adaptée au faible volume attendu au démarrage.

Si plusieurs instances backend sont déployées ultérieurement, le cache devra être réévalué.

---

## 18. SEO

Le référencement naturel est un objectif architectural du frontend public.

Les bonnes pratiques suivantes doivent être intégrées dès le départ :

- rendu serveur lorsque pertinent ;
- HTML sémantique ;
- `title` dynamique ;
- meta description ;
- canonical URLs ;
- sitemap XML ;
- `robots.txt` ;
- Open Graph ;
- données structurées Schema.org pertinentes ;
- balises `hreflang` pour les langues ;
- URLs propres et stables ;
- Core Web Vitals ;
- optimisation du poids JavaScript ;
- images dimensionnées et chargées correctement ;
- liens internes cohérents ;
- statut HTTP correct ;
- gestion correcte des pages inexistantes ;
- absence de contenu dupliqué évitable.

Les contraintes SEO doivent être prises en compte lors de toute évolution des pages publiques.

---

## 19. Navigation vers les articles externes

LMN24 ne crée pas de page interne détaillée pour chaque article dans le MVP.

Un clic sur une actualité ouvre directement l’URL originale du média.

Le lien s’ouvre dans un **nouvel onglet**.

Les attributs de sécurité adaptés doivent être utilisés, notamment `noopener` et `noreferrer` lorsque pertinent.

Aucun tracking interne des clics sortants n’est prévu dans le MVP.

Une solution analytics externe pourra être ajoutée ultérieurement.

---

## 20. Fallback des images

Lorsqu’un article ne fournit pas d’image :

1. utiliser le logo de la source si disponible ;
2. sinon utiliser une image générique LMN24.

Cette logique doit être centralisée dans un composant ou utilitaire réutilisable.

---

## 21. Accessibilité

Les interfaces doivent respecter les bonnes pratiques d’accessibilité web :

- HTML sémantique ;
- navigation clavier ;
- focus visible ;
- contrastes suffisants ;
- labels de formulaires explicites ;
- alternatives textuelles pertinentes ;
- ARIA uniquement lorsque nécessaire ;
- composants Bootstrap/React-Bootstrap utilisés de manière accessible.

L’accessibilité ne doit pas être traitée comme une correction de fin de projet.

---

## 22. Logs et supervision

### 22.1 Logs

Le backend et le parser utilisent **Pino**.

Les logs sont structurés et doivent permettre au minimum de retrouver :

- service ;
- niveau ;
- timestamp ;
- contexte ;
- identifiant de requête ou traitement lorsque pertinent ;
- message ;
- erreur structurée.

Les secrets, mots de passe, cookies de session et données sensibles ne doivent jamais être journalisés.

### 22.2 Supervision

Une page d’administration doit permettre de consulter les informations de supervision utiles.

Elle peut agréger notamment :

- derniers runs ;
- erreurs de feeds ;
- statuts ;
- durées ;
- volumes importés.

Les détails fonctionnels de cette page relèvent des User Stories.

---

## 23. Health checks

Le backend expose :

```text
/health
```

Le parser expose :

```text
/health
```

Ces endpoints permettent de vérifier l’état général des services.

Ils peuvent notamment vérifier l’accès à PostgreSQL lorsque pertinent.

Ils ne doivent pas exposer de secrets ni de détails sensibles.

---

## 24. Sécurité

La sécurité doit être prise en compte par défaut.

### 24.1 Principes obligatoires

- validation systématique des entrées ;
- authentification robuste ;
- autorisation par rôle ;
- hash bcrypt des mots de passe ;
- cookies HTTP-only ;
- protection CSRF ;
- prévention XSS ;
- requêtes SQL via Prisma ou requêtes paramétrées ;
- CORS avec liste d’origines autorisées ;
- rate limiting sur les endpoints sensibles, notamment l’authentification ;
- secrets uniquement via variables d’environnement ;
- dépendances maintenues à jour ;
- erreurs techniques non exposées au client ;
- Swagger non exposé publiquement sans décision explicite en production future.

### 24.2 CORS

Le backend n’accepte que les origines explicitement configurées.

Les origines autorisées sont définies par configuration/variables d’environnement.

---

## 25. Dates et fuseaux horaires

Toutes les dates sont stockées et manipulées en UTC :

- PostgreSQL ;
- backend ;
- parser.

La conversion dans le fuseau horaire du visiteur ou de l’interface est effectuée uniquement à l’affichage lorsque nécessaire.

---

## 26. Tests

### 26.1 Tests unitaires

Vitest est utilisé pour les tests unitaires.

Priorités :

- règles métier ;
- parser ;
- normalisation RSS/XML ;
- paramètres ;
- sécurité ;
- utilitaires.

### 26.2 Tests d’intégration

Les tests d’intégration couvrent notamment :

- backend ↔ PostgreSQL ;
- parser ↔ PostgreSQL ;
- contrats API ;
- authentification ;
- ingestion d’un feed.

### 26.3 Tests end-to-end

Playwright couvre les parcours critiques :

- accès public ;
- changement de langue ;
- authentification admin ;
- opérations administratives prioritaires.

Les User Stories précisent les scénarios métier attendus.

---

## 27. Qualité du code

Les trois applications utilisent :

- TypeScript strict ;
- ESLint ;
- Prettier ;
- conventions de nommage cohérentes ;
- configuration centralisée lorsque pertinent.

Les versions communes doivent être alignées autant que possible dans le monorepo, notamment pour :

- TypeScript ;
- Prisma ;
- Zod ;
- ESLint ;
- Vitest ;
- outils de build.

---

## 28. Git et GitHub

### 28.1 Branche principale

`main` représente le code stable.

### 28.2 Branches de travail

Chaque fonctionnalité ou ticket est développé dans une branche dédiée.

Convention recommandée :

```text
feature/LMN-12-feed-parser
fix/LMN-34-login-error
```

Le numéro Jira doit apparaître dans le nom de branche lorsque le changement correspond à un ticket Jira.

### 28.3 Commits

Les commits liés à une User Story ou un ticket doivent inclure la clé Jira lorsque pertinent.

### 28.4 Pull Requests

Les changements sont fusionnés vers `main` via Pull Request.

La PR doit permettre de vérifier :

- ticket Jira ;
- description du changement ;
- tests ;
- impacts architecture/data model éventuels.

---

## 29. CI avec GitHub Actions

Chaque Push et Pull Request doit pouvoir déclencher automatiquement :

1. installation des dépendances ;
2. lint ;
3. tests ;
4. build.

Turborepo peut optimiser l’exécution grâce à son graphe de dépendances et son cache.

Aucun déploiement automatique n’est imposé tant que la stratégie d’hébergement n’est pas définie.

---

## 30. Environnement de développement

Le MVP démarre avec **un environnement local de développement**.

Il n’existe pas encore de politique formelle imposant :

- development ;
- test ;
- staging ;
- production.

Cette stratégie sera définie lorsque l’hébergement et le déploiement seront décidés.

PostgreSQL fonctionne localement pour le développement initial.

---

## 31. Docker

Docker et Docker Compose ne font pas partie des exigences du MVP.

Les services doivent pouvoir être lancés de manière classique avec Node.js, pnpm et PostgreSQL.

L’architecture ne doit toutefois pas empêcher une future conteneurisation.

---

## 32. Hébergement

Aucun fournisseur n’est imposé actuellement.

L’architecture doit rester compatible avec différentes solutions d’hébergement.

Le choix sera effectué ultérieurement selon :

- coûts ;
- trafic ;
- contraintes réseau ;
- besoin de tâches planifiées ;
- PostgreSQL managé ou non ;
- disponibilité ;
- facilité d’exploitation.

---

## 33. README et documentation

Le dépôt doit contenir :

- un `README.md` racine ;
- un README dans `apps/frontend` ;
- un README dans `apps/backend` ;
- un README dans `apps/parser`.

Chaque README d’application doit documenter au minimum :

- rôle du composant ;
- prérequis ;
- installation ;
- variables d’environnement ;
- lancement ;
- tests ;
- build.

La documentation doit être mise à jour lorsqu’un changement rend les instructions existantes incorrectes.

---

## 34. Paramètres fonctionnels vs configuration technique

Une distinction stricte doit être conservée.

### 34.1 Table `Setting`

Utilisée pour les paramètres transversaux modifiables à chaud ou depuis l’administration. Les paramètres **propres à une entité** peuvent être stockés directement sur cette entité : pour l’accueil, `Category` porte `displayOrder`, `layoutType`, `themeColor`. La capacité d’articles est une règle du modèle de mise en page, **pas** un paramètre configurable.

Exemples :

- langue par défaut ;
- fréquence du parser ;
- retries ;
- timeout ;
- concurrence ;
- durée de conservation ;
- date de référence de purge ;
- durée du cache.

### 34.2 Variables d’environnement

Utilisées pour les paramètres nécessaires au démarrage ou secrets.

Exemples :

- ports ;
- `DATABASE_URL` ;
- secrets ;
- SMTP ;
- CORS ;
- URLs inter-services.

Une valeur qui doit être connue **avant connexion à PostgreSQL** ne doit pas être uniquement stockée dans `Setting`.

---

## 35. Flux principaux

### 35.1 Consultation d’actualités

```text
Navigateur
  → Next.js
  → Backend REST
  → Cache backend éventuel
  → PostgreSQL
  → Backend
  → Next.js
  → HTML rendu
```

### 35.2 Import automatique

```text
node-cron
  → Parser
  → Lecture Setting
  → Sélection feeds actifs
  → Téléchargement RSS/XML
  → Parsing / normalisation
  → Déduplication articleUrl
  → Prisma
  → PostgreSQL
  → FeedRun / logs
```

### 35.3 Import manuel

```text
Admin
  → Frontend
  → Backend
  → API interne sécurisée du parser
  → Parser
  → PostgreSQL
```

### 35.4 Maintenance et purges indépendantes

```text
Module de maintenance planifié (apps/parser)
  → Lecture de chaque clé de rétention (Setting / scope GLOBAL)
  → Purges distinctes : article / video / feed_run / feed_video_run
  → Expiration et cohérence des compteurs hashtag_hourly_count
  → Rotation / purge des fichiers de logs gérés par LMN24, le cas échéant
  → Bilan journalisé, métriques et reprise sur échec
```

---

## 36. Décisions volontairement différées

Les sujets suivants ne sont pas figés dans le MVP :

- hébergement final ;
- stratégie multi-environnements ;
- Docker ;
- Redis ;
- API publique ;
- analytics ;
- multi-instance du parser ;
- mécanisme distribué de verrouillage ;
- stratégie de sauvegarde PostgreSQL ;
- internationalisation de l’administration.

Ils ne doivent être introduits que lorsqu’un besoin réel le justifie.

---

## 37. Règle d’évolution de l’architecture

Toute modification significative concernant :

- technologies ;
- communication inter-services ;
- sécurité ;
- stockage ;
- modèle de données ;
- conventions de monorepo ;
- stratégie de cache ;
- stratégie de parsing ;
- mécanisme d’authentification ;

doit entraîner une mise à jour de `ARCHITECTURE.md`.

Le document doit toujours refléter l’architecture réellement utilisée par le code.


---

## Extension cible — Agrégation des vidéos YouTube (documentation préalable)

> **Statut : architecture cible, non implémentée.** Cette section complète `docs/DATA_MODEL.md` (§13). Aucun changement du schéma Prisma, aucune migration, aucun nouveau parser ni écran ne résulte de cette mise à jour documentaire.

### Objectif et périmètre du MVP vidéo

LMN24 pourra référencer des vidéos publiées par ses sources de presse via les **flux Atom XML publics des chaînes YouTube**, sans télécharger ni héberger les fichiers vidéo. L'objectif est une rubrique publique **Vidéos**, complétée ultérieurement par des entrées ou onglets « Articles / Vidéos » sur les pages publiques des sources et des catégories. La page d'accueil éditoriale existante reste inchangée lors du premier incrément.

- Une `Source` peut référencer **plusieurs flux vidéo** / chaînes YouTube.
- Une `Video` possède une source, une catégorie et une langue principales pour le MVP.
- Shorts et directs sont traités comme des vidéos lorsqu'ils figurent dans le flux ; le parser ne déduit pas leur type sans information fiable.
- Désactiver un `FeedVideo` suspend la collecte et **ne masque pas** ses vidéos ; la publication d'une vidéo est contrôlée séparément par `Video.isPublished`.

### Architecture logique

```text
YouTube (flux Atom XML publics par channel_id)
                      |
                      | HTTPS (récupération périodique et manuelle)
                      v
             apps/parser (module vidéo)
               | validation XML / namespace yt: et media:
               | normalisation / déduplication / journalisation
               v
     packages/database (Prisma commun)
               |
               v
            PostgreSQL
      feed_video / video / feed_video_run
               ^
               | Prisma
               |
       apps/backend (NestJS)
       | API admin vidéo + déclenchement contrôlé du parser
       | API publique vidéo filtrée/paginée
               ^
               | REST via backend
               |
       apps/frontend (Next.js)
       | Admin : flux vidéo, vidéos, états et exécutions
       | Public : Vidéos, filtres, onglets Source/Catégorie
```

L'architecture **conserve les trois applications existantes**. Le traitement vidéo est un module indépendant du traitement des articles au sein de `apps/parser`, et **non** un quatrième service ou une nouvelle base. Le navigateur ne contacte jamais directement le parser ni PostgreSQL. Le backend applique les validations et autorisations existantes ; l'API interne backend → parser reste protégée par son mécanisme de secret partagé.

### Modèle et conventions techniques

- Trois tables nouvelles, documentées dans `docs/DATA_MODEL.md` : `feed_video` (configuration et état), `video` (métadonnées éditoriales), `feed_video_run` (historique technique).
- Même convention que les entités existantes : **PostgreSQL `snake_case`**, **Prisma / TypeScript `camelCase`**, UUID et timestamps UTC.
- `FeedVideo` est rattaché à `Source`, `Category` et `Language` ; `Video` est directement rattaché à ces trois référentiels et comporte également `feedVideoId` **nullable** pour tracer son flux d'origine.
- Identité du flux : `feedUrl` unique et couple `(platform, channelId)` unique. Identité de la vidéo : couple `(platform, platformVideoId)` unique ; la contrainte en base constitue la dernière défense contre les imports concurrents.
- Un enum `platform` démarre à `YOUTUBE`, avec possibilité d'extension seulement après implémentation d'un adaptateur spécifique à la nouvelle plateforme.
- Une modification de classification (catégorie/langue) par un éditeur devra être préservée lors des synchronisations suivantes ; prévoir la distinction entre métadonnées de plateforme et décisions éditoriales avant le développement des mises à jour automatiques.
- `Source.youtubeUrl` reste un **lien social informatif** : aucune création automatique de flux. L'identification de la chaîne `channelId` depuis un `@handle` est une étape d'assistance nécessitant confirmation par l'administrateur.

### Parser vidéo et exploitation

- Exploiter `apps/parser`, sa planification, sa configuration via `Setting`, ses logs Pino et ses protections de timeout, retry et concurrence. Les réglages propres au traitement vidéo devront être distincts de ceux des flux d'articles quand les comportements divergent.
- Télécharger le XML Atom YouTube avec contrôles de sécurité des URLs sortantes (HTTPS, domaine YouTube attendu, redirections limitées, refus des hôtes internes, taille de réponse bornée, timeout) et parser les espaces de noms `yt:` et `media:` de manière explicite.
- Identifier chaque entrée via `yt:videoId`, prendre `Source`, `Category` et `Language` initiales depuis le flux configuré, puis enregistrer les métadonnées vidéo (titre, description, miniature, date, URL). **Ne jamais télécharger la vidéo**.
- Effectuer des **upserts** idempotents. Les doublons ne génèrent pas de nouvelles lignes ; les mises à jour des champs issus de YouTube ne doivent pas écraser la décision de publication ou les reclassements éditoriaux.
- Écrire un `FeedVideoRun` à chaque tentative avec statut, durées, compteurs et erreur éventuelle ; maintenir également les champs `lastFetch*` de `FeedVideo`.
- Les flux YouTube ne fournissent qu'une **fenêtre récente limitée** et ne garantissent pas l'historique complet. Une collecte périodique sera nécessaire pour réduire les omissions ; la fréquence exacte sera définie dans Jira et `Setting`.
- Un échec isolé de flux vidéo n'empêche pas le traitement des autres flux (articles ou vidéos). Un lancement manuel depuis l'administration utilise le circuit sécurisé frontend → backend → API interne parser.

### APIs, interfaces et publication

- **Administration** : gérer les flux vidéo (CRUD, validation, activation, collecte manuelle), consulter les vidéos et leur état de publication, examiner les exécutions et erreurs, filtrer par source, pays, langue, catégorie et date.
- **Public** : endpoints dédiés aux vidéos publiées, avec pagination par curseur et tri stable `publishedAt DESC, id DESC` ; respecter la langue sélectionnée et les catégories/sources pertinentes.
- **Présentation** : miniatures 16:9, titre, date et identité du média ; ouvrir YouTube ou intégrer son lecteur officiel uniquement sur action du visiteur, avec option de confidentialité renforcée lorsque disponible. Éviter tout script ou lecteur chargé avant nécessité ; prévoir un repli accessible.
- Étendre les statistiques et la supervision aux collectes vidéo sans mélanger implicitement leurs compteurs avec les collectes d'articles.
- Conserver les URLs externes en HTTP(S) autorisé, échapper les métadonnées non fiables, appliquer les protections d'intégration et ne pas exposer les messages techniques sensibles côté public.

### Ordre de réalisation et contrôles qualité

1. Créer la Story Jira de migration, puis modifier `packages/database/schema.prisma` et créer une migration **additive et non destructive** depuis `packages/database` ; valider contraintes/index et compatibilité avec les données en place.
2. Développer contrats Zod partagés, services et routes NestJS de gestion des flux vidéo, avec tests de validation et d'authentification.
3. Créer l'interface d'administration des flux et le déclenchement manuel.
4. Implémenter le parsing Atom YouTube, le stockage transactionnel/idempotent, l'historique `FeedVideoRun`, les reprises sur erreurs et les tests sur des flux d'exemple.
5. Construire l'administration des vidéos, la publication/dépublication et les pages publiques dédiées, puis enrichir les pages Source/Catégorie.
6. Intégrer les statistiques et les tests bout-en-bout, vérifier sécurité, performances et CI.

Les conventions existantes de ce document restent applicables (Prisma partagé, authentification, logs, REST, PostgreSQL, UTC, tests et revue GitHub). Aucune migration n'est considérée exécutée tant qu'elle n'a pas été développée, testée et appliquée explicitement.

---

## Extension cible — Hashtags et tendances (documentation préalable)

> **Statut : conception cible, à développer par les User Stories Jira.** Ce document ne crée ni migrations Prisma ni tâches planifiées. Les tables et contraintes détaillées figurent dans `docs/DATA_MODEL.md` §14.

### Administration et médias

- Gestion des sujets `Hashtag` : création, modification, suppression contrôlée, activation, nom de référence, slug et alias multilingues `HashtagAlias`.
- Image illustrative facultative : upload depuis l'administration ou import depuis une URL validée, convertie en WebP et enregistrée dans un **répertoire persistant** distinct de PostgreSQL, avec contrôles de type, taille et contenu. Ne pas écrire dans un répertoire éphémère du build Next.js ; la sauvegarde des images doit être prévue par l'hébergement.
- Boutons de recherche externe (Google Images et, facultativement, Wikimedia Commons) dans un nouvel onglet. Les droits de réutilisation et les éventuelles obligations d'attribution restent à vérifier avant import.

### Détection et comptabilisation

- Recherche d'un hashtag dans `Article.title` et `Article.summary` via son nom et ses alias ; recherche tolérante à la casse/aux accents tout en évitant les sous-chaînes non pertinentes. Les mêmes règles de normalisation s'appliquent au calcul et à la page de détail.
- **Une seule mention par article et par hashtag**, même en présence de plusieurs alias. Les mentions sont rattachées à l'heure UTC de `Article.publishedAt`, pas à la date d'import.
- Le module d'ingestion actualise les agrégats horaires `HashtagHourlyCount` sans table persistante `ArticleHashtag`. Les imports tardifs, modifications, suppressions et nouveaux alias entraînent une remise à niveau des créneaux affectés ou une reconstruction bornée et idempotente depuis les articles conservés ; ne pas simplement incrémenter à chaque tentative d'import.
- Un automate horaire calcule/met en cache les classements publics sur **24 heures / 7 jours / 30 jours**, limités à la période de rétention disponible. Le classement peut proposer le volume de mentions et sa progression ; ces critères seront précisés dans Jira.
- Sur PostgreSQL, étudier les index de recherche textuelle (notamment `pg_trgm`) en tenant compte des langues et de la normalisation. Les requêtes publiques doivent être paginées et testées sur les volumes attendus (500 flux et ~250 hashtags).

### Présentation publique et APIs

- La route localisée de classement Hashtags affiche les images, les noms, les nombres de mentions et la période sélectionnée ; seul un hashtag actif est public.
- Un clic sur le nom ou l'image ouvre la page du hashtag, qui affiche les articles correspondants **toutes langues confondues**, contrairement à la règle habituelle de filtre linguistique des pages catégories. Cette exception s'applique exclusivement à la page détail d'un hashtag.
- La composition de cette page réemploie celle d'une page catégorie : premier bloc « À la Une + grille », puis alternance des grilles 3×2 et 4×2 ; tri `publishedAt DESC` et départage `id DESC`, liens vers les sources d'origine, drapeaux et respect du responsive.
- Le frontend ne consulte jamais directement PostgreSQL : NestJS fournit des APIs d'administration authentifiées et des APIs publiques paginées et protégées contre les recherches excessives.
- Les tableaux horaires sont soumis à `retentionHashtagHourlyCountsDays` et aux limites des données articles encore disponibles. Les définitions et images de hashtags sont conservées tant qu'un administrateur ne les supprime pas.

### Contrat de comptage et règles MVP à valider

- Le compteur mesure le **nombre d'articles distincts** comportant le nom principal ou un alias dans le titre ou le résumé ; plusieurs occurrences d'un même sujet dans un article comptent une seule fois. Les articles d'autres langues sont inclus. Les vidéos ne sont pas comptabilisées pour ce MVP.
- La détection est **lexicale et explicite** : normalisation Unicode/espaces/casse/accents latins et respect des frontières de mots ; pas de traduction automatique, synonymie, apprentissage d'entités nommées ou traitement sémantique implicite. Les variantes en différentes écritures doivent être saisies dans `HashtagAlias`. Pour les homonymes (ex. « Orange »), l'administration avertit des risques de faux positifs, sans promettre une distinction personne/ville/marque automatique.
- La page détaillée appelle un **même service de correspondance versionné** que le parser/recalcul : il ne doit pas y avoir deux règles de détection concurrentes. Le calcul des statistiques peut être différé, mais la correspondance lexicale doit rester identique.
- Les périodes 24 h, 7 j et 30 j sont définies sur des **heures UTC closes**. À l'heure `T`, compter `[T-P,T)`, comparer à `[T-2P,T-P)`. La fenêtre maximale de comparaison requiert 60 jours de données conservées.
- Le mode « Plus cités » trie par nombre d'articles décroissant. Le mode « Tendances » lit obligatoirement les paramètres globaux `hashtagTrendMinMentions` (défaut 10), `hashtagTrendMinIncrease` (défaut 5), `hashtagTrendScoreFloor` (défaut 5) dans `Setting` ; éligibilité `Nactuel >= minMentions` et `Nactuel - Nprécédent >= minIncrease`, score `(Nactuel - Nprécédent) / max(Nprécédent, scoreFloor)`, tri score puis volume. Afficher « Nouveau » si période précédente à zéro, « — » si période précédente non couverte. Ne pas afficher de pourcentage infini.
- Les variations de rang (places gagnées/perdues) et l'analyse sémantique automatique sont **hors MVP**. Les trois réglages de tendances sont modifiables par un administrateur via une rubrique « Paramètres des tendances » et une API NestJS sécurisée ; validation entière >= 1, `scope=GLOBAL`, `type=INTEGER`. Ils sont communs aux fenêtres 24 h / 7 j / 30 j. Chaque modification invalide la vue ou le cache des classements et déclenche un nouveau calcul à la prochaine exécution horaire (ou via déclenchement explicite), sans recalculer inutilement les compteurs horaires sous-jacents.
- Documentation exhaustive de la règle et des exemples dans `docs/DATA_MODEL.md` §14.5–14.6.

### Stratégie d'agrégation, d'intégrité et de performances

1. À l'insertion **effective** d'un `Article` non dupliqué, rechercher les hashtags actifs, puis enregistrer en base les agrégats `HashtagHourlyCount` sur l'heure UTC de `publishedAt`. Écarter les publications futures et les articles hors de la durée de rétention. Ne pas re-compter les tentatives de parsing.
2. Une tâche horaire distincte du parser reconstruit/reconcilie les heures affectées par des imports tardifs, modifications, purges ou changements d'alias ; une reconstruction bornée sur les **60 derniers jours** est déclenchable depuis l'administration lors d'une modification des règles ou d'une nouvelle définition. Le recalcul s'appuie exclusivement sur les articles conservés.
3. Les upserts sur `(hashtagId, hourUtc)`, la reconstruction par lots et l'activation des résultats doivent être **idempotents**. Prévoir un verrou/lease de traitement et des publications atomiques de nouveaux classements : une reconstruction partielle ne doit pas apparaître comme un classement complet.
4. Les classements sont recalculés ou mis en cache **au plus une fois par heure**, après clôture de l'heure UTC ; l'API renvoie le `T` effectif et le statut de fraîcheur. Les pages détaillées restent consultables avec une recherche directe paginée dans `Article` indépendamment de la disponibilité d'un calcul de classement.
5. Les comptages par heures agrégées **ne représentent pas un comptage glissant à la minute**. La page détaillée peut inclure des articles plus récents que `T`, et son nombre de résultats peut donc différer du total affiché pour une fenêtre du classement : l'interface doit expliquer le décalage de fraîcheur.
6. Les comparaisons sur 30 j exigent 60 j d'articles et de compteurs ; si la politique de rétention ou l'historique disponible ne les couvre pas, **désactiver le mode de progression concerné** et afficher une information explicite. Les suppressions en masse invalident et recalculent les agrégats, sans conserver de « mentions fantômes ».
7. Rechercher par `slug` et traiter les expressions et alias en **paramètres SQL**, jamais par concaténation de regex/SQL provenant de la saisie utilisateur. Évaluer `pg_trgm` et les plans `EXPLAIN (ANALYZE, BUFFERS)` sur des volumes réalistes de 500 flux, ~250 hashtags, 60 jours d'articles. Réutiliser autant que possible les structures et paginations des pages catégories ; ne jamais transférer des listes d'articles non bornées au navigateur.
8. L'import d'image depuis une URL est effectué côté backend avec HTTPS, restrictions d'hôtes internes/réseaux privés, contrôle de redirections, de poids, de type MIME et décodage effectif. Stocker l'image WebP dans un emplacement persistant sauvegardé, hors base et hors build Next.js. Google Images / Wikimedia Commons ne sont **que des raccourcis de recherche**, pas une source de droits présumés.

### Administration des durées de rétention

- Ajouter une page ou section administrative « Conservation des données » avec **un champ numérique en jours pour chaque famille** : articles, vidéos, historiques parser infos et parser vidéos, fichiers logs parser infos et parser vidéos, fichiers logs backend, compteurs horaires hashtags.
- Une API NestJS réservée à `ADMIN` lit/modifie exclusivement ces clés autorisées, vérifie leur existence, le type `INTEGER`, les bornes autorisées et `scope=GLOBAL`, puis renvoie les valeurs effectives. Les modifications prennent effet au prochain cycle de maintenance.
- Les paramètres d'historique `FeedRun`/`FeedVideoRun` sont séparés des journaux techniques Pino ; un réglage de logs locaux n'est applicable que si des fichiers réellement gérés par LMN24 existent. Les journaux stdout/externalisés et les sauvegardes nécessitent une politique indépendante côté hébergeur.
- La création initiale des huit clés est fournie dans `database/seed_retention_settings.sql`. Les valeurs sont installées en base uniquement si l'administrateur exécute ce SQL (ou une procédure de seed dédiée). Tant que les jobs ne sont pas développés, elles n'entraînent **aucune purge**.



### SCRUM-50 — Stockage d’images des hashtags (implémenté)

Le backend NestJS assure l’import contrôlé et la publication des images de hashtags. `HASHTAG_MEDIA_DIR` définit un répertoire en lecture/écriture **persistant et sauvegardé**, distinct du build Next.js et de PostgreSQL. À défaut, le stockage local par défaut est `apps/backend/uploads/hashtags`, réservé aux tests et développements ; en production OVH, monter/configurer explicitement un volume durable.

- Upload ADMIN : `POST /admin/hashtags/:id/image` (multipart, champ `file`), 8 Mo au maximum, formats JPEG/PNG/WebP réellement décodables.
- Import HTTPS ADMIN : `POST /admin/hashtags/:id/image/import` (`{url}`), adresses IP publiques uniquement, DNS épinglé sur l’IP validée, contrôle de chaque redirection, délai et taille bornés, refus des contenus non-images.
- Transformation serveur `sharp` : orientation, conversion WebP, taille maximale 1200 × 675, qualité 78 ; nom de fichier aléatoire UUID, pas de fichiers stockés en base.
- Lecture publique : `/api/media/hashtags/:filename` via proxy Next.js vers `GET /media/hashtags/:filename` ; contrôle strict du nom de fichier, type `image/webp`, cache côté navigateur.
- Remplacement/suppression : mise à jour conditionnelle de `Hashtag.imageUrl`, nettoyage de l’ancienne image après confirmation de la sauvegarde ; conservation de l’ancienne image en cas d’échec de la conversion, du téléchargement ou de la mise à jour.
- Les boutons Google Images et Wikimedia Commons ouvrent des recherches externes dans un nouvel onglet, **sans téléchargement automatisé** ; l’administrateur est responsable des licences et crédits.
- Ne jamais stocker `HASHTAG_MEDIA_DIR` dans un répertoire éphémère OVH. Prévoir permissions minimales, sauvegarde et supervision de l’espace disque ; le remplacement physique du volume doit être coordonné avec les fichiers déjà référencés en base.


### SCRUM-51 — Moteur lexical commun et analyse historique (implémenté)

- Le contrat partagé `packages/contracts/src/hashtag-matching.ts` définit **une seule règle de correspondance** pour le parser, l'administration et les futures pages publiques : normalisation Unicode NFKC, casse/accents via le helper existant, espaces et tirets normalisés, limites de mots Unicode, et alias explicitement saisis. Il ne réalise aucune traduction automatique ou analyse sémantique.
- Dans `apps/parser/src/parser-engine.ts`, les hashtags actifs et leurs alias sont chargés **une seule fois par extraction**. Le parser utilise `createManyAndReturn(skipDuplicates: true)` pour détecter les correspondances **uniquement parmi les articles effectivement insérés** (aucun comptage sur une URL déjà présente). Le nombre d'articles nouvellement importés mentionnant au moins un hashtag apparaît dans les événements de l'extraction ; il ne s'agit **pas** de statistiques horaires persistées.
- Dans l'administration, `POST /admin/hashtags/:id/analyze` (ADMIN uniquement) analyse les articles de toutes les langues **par lots de 500**, en ordre stable par identifiant, dans la limite de `retentionArticlesDays`. Le curseur, le point de référence `asOf` et la version du hashtag protègent la cohérence d'une analyse longue. Réponse : `scannedArticles`, `matchingArticles`, compteurs par heure UTC, `nextCursor`, date de référence et version de définition. L'interface permet de lancer/arrêter une analyse, sans charger tous les articles en mémoire ou dans le navigateur.
- L'analyse est **non persistante** : ni lien article–hashtag ni statistiques horaires ne sont enregistrés par SCRUM-51. La reconstruction **persistante, automatisée, cohérente avec les créations/éditions/suppressions** et les classements relèvent de **SCRUM-52 et SCRUM-53**.
- Les tests couvrent les alias multilingues, les doublons, les limites de mots, la pagination et la rétention. La recherche de détail public devra impérativement réutiliser ce contrat, sans interprétation différente côté PostgreSQL.


### SCRUM-52 — Compteurs horaires persistants et recalcul fiable

- **Transaction atomique** : `insertArticlesAndCount` (`packages/database/src/hashtag-stats.ts`) charge les noms/alias actifs puis exécute `Article.createManyAndReturn(skipDuplicates:true)` dans la **même transaction PostgreSQL** que les `HashtagHourlyCount.upsert`. Si une opération échoue, toutes les écritures du lot sont annulées et peuvent être rejouées. Une URL existante n'incrémente jamais un compteur.
- **Unité** : 1 article distinct = au plus 1 mention par hashtag, indépendamment du nombre de variantes dans le titre/résumé. Heure de comptabilisation = début de l'heure UTC de **`publishedAt`**, pas `createdAt`. Les articles futurs et hors fenêtre de rétention sont exclus des incréments.
- **Sérialisation interprocessus** : le parser, les modifications/suppressions de définitions administratives et les reconstructions utilisent le même verrou transactionnel PostgreSQL `pg_advisory_xact_lock(52024, 52)` : ordre cohérent, pas de cumul concurrent entre incréments et remplacement de compteurs. Ce verrou n'empêche pas les lectures publiques mais peut ralentir temporairement les insertions lors d'une reconstruction lourde.
- **Reconstruction** : `rebuildHashtagHourlyCounts` scanne en pages de 500 les articles toujours présents, avec le moteur lexical partagé ; elle remplace **atomiquement** les agrégats de toutes les heures ou d'un hashtag spécifique. Aucune association `ArticleHashtag` persistante et aucune conservation des contenus au-delà de la politique de rétention.
- **Administration** : création/modification/réactivation d'un hashtag ou de ses alias déclenche un recalcul ciblé asynchrone ; un bouton « Reconstruire les compteurs horaires » et une API ADMIN `POST /admin/hashtags/:id/rebuild` permettent de le relancer. Les traitements immédiats sont best-effort ; une reconstruction complète périodique répare un arrêt de service ou des modifications SQL externes.
- **Planification parser** : à **HH:10 UTC** chaque heure, réconciliation des **48 heures précédentes** ; à **03:35 UTC** chaque jour, reconstruction complète des périodes conservées, destinée notamment à corriger les suppressions et modifications d'articles hors administration. Le parser expose également (avec son secret interne) `POST /hashtag-stats/rebuild` et `GET /hashtag-stats/status` pour une reconstruction manuelle/monitoring. Une seule reconstruction par instance est lancée à la fois ; le verrou base garantit la sérialisation entre instances.
- **Rétention** : fenêtre = minimum de `retentionArticlesDays` et `retentionHashtagHourlyCountsDays` (60 jours par défaut). Un recalcul complet efface également les agrégats devenus obsolètes. Une diminution de la durée articles n'a pas d'effet sur les sauvegardes ni ne rétablit une donnée déjà effacée.
- **Limitation à surveiller** : un recalcul complet peut lire jusqu'à 60 jours d'articles et nécessite une transaction longue sous verrou commun. Tester la durée et la contention à 500 flux et ~250 sujets, puis envisager une file persistante d'heures « dirty » si les performances l'exigent. Les classements publics/leurs seuils et leur cache relèvent de SCRUM-53.


### SCRUM-53 — Réglages des tendances et calcul des classements

- **Administration** : rubrique `/admin/hashtag-trends`, API NestJS ADMIN `GET/PUT /admin/hashtag-trend-settings`. Les paramètres `hashtagTrendMinMentions` (défaut 10), `hashtagTrendMinIncrease` (5), `hashtagTrendScoreFloor` (5) sont des entiers positifs dans les enregistrements `Setting` GLOBAL déjà installés via `database/seed_hashtag_trend_settings.sql` ; leur mise à jour est **atomique**. Aucune nouvelle migration SQL pour SCRUM-53.
- **API publique de lecture (interface prévue SCRUM-54)** : `GET /hashtags/rankings?period=24h|7d|30d&mode=most-cited|trending&page=1&pageSize=20`, également relayée via Next.js `/api/hashtags/rankings`. Elle renvoie les sujets actifs, leur image/nom/slug, les volumes courants et précédents, la variation, le score, un état de fraîcheur et une pagination.
- **Fenêtres temporelles** : sur les **heures UTC entièrement terminées**, `T = floor(now, 1h)` ; période courante `[T-P,T)`, comparaison `[T-2P,T-P)` (24 h, 7 j, 30 j). `most-cited` trie par mentions décroissantes, puis slug pour départager. `trending` filtre `courant >= minMentions` et `courant - précédent >= minIncrease`, puis classe par `(courant - précédent) / max(précédent, scoreFloor)`, volume et slug.
- **Variation** : pourcentage calculé sur le vrai volume précédent, jamais sur le plancher artificiel. Si précédent = zéro et courant positif, afficher « Nouveau » ; si comparaison indisponible, `changeLabel = "—"`, `changePercent = null`. Ne jamais générer `∞ %`.
- **Disponibilité historique** : exiger au moins `2 × P` de rétention des articles **et** des compteurs, une reconstruction complète récente (moins de 48 h), ainsi qu'une date de première collecte attestée par le corpus conservé antérieure au début de la comparaison. À défaut, le classement « Plus cités » reste affichable avec couverture limitée, mais le mode « Tendances » renvoie zéro résultat et une raison explicite (`comparisonAvailable=false`). Cela évite de donner un faux signal à l'installation initiale.
- **Indicateurs de qualité des calculs** : la reconstruction complète de SCRUM-52 écrit, **dans la même transaction de remplacement des compteurs**, deux paramètres système de type `STRING` (date ISO 8601 UTC) : `hashtagStatsLastFullRebuildAt` et `hashtagStatsCoverageSinceUtc`. Ils sont créés automatiquement au premier recalcul réussi, sans script SQL supplémentaire. Un échec ne met jamais à jour ces indicateurs ; le statut `fresh|stale|unverified` est exposé dans la réponse publique.
- **Cache** : calcul du classement une seule fois par heure UTC et par période au sein d'une instance backend. Invalidation directe après mise à jour des paramètres ou reconstruction ciblée, ou indirectement au changement de l'heure ou des indicateurs de reconstruction. Les deux modes réutilisent le même ensemble de sommes PostgreSQL (deux `GROUP BY hashtag_id` par période). En déploiement multi-instance, chaque instance possède son propre cache de courte durée : la signature des paramètres et des marqueurs est relue à chaque requête ; un recalcul ciblé dans une autre instance sera pris en compte au plus tard à l'heure suivante.
- **Exploitation** : pour disposer de comparaisons dès que l'historique le permet, exécuter une reconstruction **complète** une fois après la mise à jour (route interne du parser `POST /hashtag-stats/rebuild` avec le secret partagé), ou laisser passer l'exécution programmée à 03:35 UTC. Avant cette première reconstruction, l'API signale volontairement une comparaison non vérifiée.


### SCRUM-54 — Page publique des classements de hashtags

- Nouvelle entrée d'en-tête **Hashtags**, dans les 8 langues LMN24, et lien de pied de page desktop. Route publique `/[locale]/hashtags` ; la navigation conserve la langue active dans l'URL.
- La page Next.js effectue le rendu côté serveur (SSR dynamique) via l'API NestJS `GET /hashtags/rankings` créée par SCRUM-53. Les sélecteurs **Plus cités / Tendances**, **24 h / 7 j / 30 j** et la pagination utilisent des liens avec paramètres d'URL `period`, `mode` et `page`, compatibles clavier, sans état client persistant. Le backend reste l'unique calculateur des scores et de l'ordre.
- Les statistiques couvrent les **articles de toutes les langues**. Seuls les hashtags actifs sont retournés par l'API ; aucune modification des pages catégorie, qui restent filtrées par langue.
- Cartes Bootstrap/CSS responsive (3 colonnes desktop, 2 tablette, 1 mobile) : image gérée localement sur LMN24 ou fallback `#` lors d'absence/erreur, nom, rang, mentions, évolution (« Nouveau »/« — ») et période/fraîcheur de calcul. Gestion de l'absence de données, de la comparaison non fiable et de l'API momentanément indisponible sans pourcentage infini.
- Le clic sur l'image ou le nom renvoie vers `/[locale]/hashtags/[slug]`. Une première fiche est disponible dans SCRUM-54 ; elle charge la fiche publique active via `GET /hashtags/:slug` (404 si absent/inactif), sans afficher les articles. Le rendu détaillé des articles, de toutes les langues et en ordre de publication, est réservé à **SCRUM-55**.
- En particulier, la route `[locale]/hashtags` n'exige pas d'authentification ni d'exposition de l'API admin. La page de classement et la fiche ne retournent pas les alias, e-mails ou informations internes.


### SCRUM-55 — Détail public d'un hashtag : articles internationaux

- **Page** `/[locale]/hashtags/[slug]` : en-tête avec photo/fallback, nom, lien retour à la liste et mention explicite de la couverture internationale. Les articles sont chargés à partir de `GET /public/hashtags/:slug/articles` (NestJS) puis en continu par `/api/public/hashtags/:slug/articles` (proxy Next.js). Aucun filtrage par la langue affichée : un visiteur sur `/fr/hashtags/moscou` voit notamment les titres français, anglais et russes.
- **Matching exact** : noms principaux et alias de la fiche active, traités par `compileHashtags` / `matchArticleHashtags` du contrat partagé avec le parser. Correspondance Unicode (NFKC, casse, accents latins, ponctuation, frontières de mots), séparément sur `title` et `summary`; un article ayant plusieurs correspondances n'est renvoyé qu'une seule fois.
- **Pagination** : ordre stable `publishedAt DESC, id DESC`, curseur opaque du module Catégories, et lecture PostgreSQL en lots de 400 lignes limitée par `retentionArticlesDays` et la date présente. Seuls les 19 premiers articles affichés, puis les lots de 14, sont détaillés avec la relation source/pays. Aucun scan complet n'est conservé en mémoire et aucune table `article_hashtag` n'est créée.
- **Rendu** : réutilisation directe de `CategoryArticles` / `ArticleCard` et des helpers de layout : **FEATURED (5)** une fois, puis **GRID (6)** / **COMPACT (8)** en alternance, avec drapeau du pays de la source, photo des articles, titre, date et lien vers le média original. Les liens externes sont validés par les composants communs.
- **Sécurité et états** : hashtag inactif ou absent renvoie 404 ; fiche active sans article = état vide ; problème temporaire d'API = message d'erreur/réessai sans exposer de donnée admin.
- **Performance** : les articles candidats sont parcourus par curseur et index `published_at`; pour un hashtag très rare, la recherche doit potentiellement analyser une grande part des articles conservés afin d'obtenir une page de résultats. Un futur index matérialisé des titres/résumés normalisés (`pg_trgm`, alimenté par le même moteur partagé et backfill historique) pourra optimiser ce cas **sans compromettre** la sémantique Unicode. Benchmark de référence 500 flux / 250 hashtags avant production ; ne pas remplacer ce moteur par une simple recherche `ILIKE` qui manquerait des variantes.


### SCRUM-56 — Administration des durées de conservation (implémenté)

- Interface ADMIN : `/admin/retention`, accessible depuis la carte **Conservation des données** du tableau de bord. Présentation des **huit durées indépendantes** (articles, vidéos, exécutions Infos/Vidéos, logs locaux Infos/Vidéos/backend, compteurs horaires Hashtags), toutes exprimées en jours. Chaque durée est enregistrable séparément.
- Référentiel partagé `packages/contracts/src/retention-settings.ts` ; valeurs par défaut documentaires **60 / 60 / 14 / 14 / 7 / 7 / 7 / 60**, uniquement pour la description et les seeds. Les paramètres **réels** sont exclusivement lus dans `Setting` (type `INTEGER`, portée `GLOBAL`, `scopeId = NULL`) via `GET /admin/retention-settings`. Absence de ligne ou valeur corrompue = erreur explicite invitant à exécuter `database/seed_retention_settings.sql` ; aucun fallback silencieux.
- Mise à jour d'un seul paramètre via `PATCH /admin/retention-settings` avec `{ key, days, expectedDays, confirmDecrease }`. Seules les huit clés connues sont autorisées ; jours = entier positif de **1 à 3650** ; toutes les opérations exigent une session avec le rôle `ADMIN`, renvoient des réponses sans cache et sont validées à nouveau côté backend.
- **Abaissement de durée** : avertissement dans le formulaire, boîte de confirmation explicite et drapeau serveur `confirmDecrease=true` obligatoire. La mise à jour est atomique (`updateMany` ciblé par clé, portée, type et ancienne valeur) avec protection contre deux administrateurs enregistrant en concurrence (409 et demande de rechargement).
- **Absence de suppression immédiate** : ni `GET` ni `PATCH` n'effacent les données. Les huit durées seront consultées par les jobs de maintenance développés dans **SCRUM-57**. Une baisse expose à une suppression irréversible au prochain cycle, et une hausse ne restaure pas les lignes antérieurement purgées.
- **Tendances** : si `retentionArticlesDays` ou `retentionHashtagHourlyCountsDays` est inférieur à **60**, la page d'administration informe que la comparaison des périodes 30 j / 30 j est impossible. Le calcul public existant dans SCRUM-53 neutralise déjà les comparaisons insuffisamment couvertes.
- Les durées des **logs techniques** portent exclusivement sur les fichiers maîtrisés par LMN24, jamais sur les logs du fournisseur d'hébergement ni sur les sauvegardes externes. Ces derniers relèvent de la configuration d'infrastructure. Aucune migration SQL nouvelle n'est exigée par SCRUM-56 ; le seed préexistant est nécessaire sur toute base non initialisée.

