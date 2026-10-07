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

Les mots de passe sont hashés avec **Argon2id**.

Ils ne sont jamais stockés ni journalisés en clair.

Politique minimale :

- 12 caractères ;
- au moins une majuscule ;
- au moins une minuscule ;
- au moins un chiffre ;
- au moins un caractère spécial.

La règle est validée côté frontend pour l’UX et obligatoirement côté backend pour la sécurité.

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

## 12. Nettoyage des articles

### 12.1 Conservation

Les articles sont des données temporaires d’agrégation.

La durée de conservation est paramétrable via l’administration.

Valeur initiale :

```text
3 jours
```

### 12.2 Date de référence

La date utilisée pour calculer l’expiration est paramétrable côté backend.

Valeur initiale :

```text
createdAt
```

Le système doit permettre ultérieurement d’utiliser `publishedAt` sans modification du code métier principal.

### 12.3 Suppression

La purge est réalisée par une tâche planifiée distincte du parser.

Les articles expirés peuvent être supprimés physiquement de PostgreSQL.

La suppression manuelle d’un article depuis l’administration est également autorisée.

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

Les catégories utilisent un slug technique stable.

Les libellés traduits résident dans `/messages/*.json`.

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

La table `Setting` est la source centrale pour les paramètres modifiables depuis l’administration.

Elle doit notamment pouvoir gérer :

- langue par défaut ;
- fréquence automatique du parser ;
- timeout global d’un feed ;
- timeout spécifique d’un feed ;
- nombre de retries ;
- concurrence maximale du parser ;
- durée de conservation des articles ;
- date de référence de conservation ;
- durée du cache backend ;
- autres paramètres métier futurs.

Un paramètre spécifique peut surcharger une valeur globale lorsque le modèle `Setting` le permet.

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

Utilisée pour les paramètres modifiables à chaud ou depuis l’administration.

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

### 35.4 Purge des articles

```text
Tâche planifiée parser
  → Lecture paramètres de rétention
  → Sélection articles expirés
  → Suppression physique
  → Logs
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
