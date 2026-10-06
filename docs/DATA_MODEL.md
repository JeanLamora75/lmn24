# DATA_MODEL.md

## Objectif

Ce document décrit le modèle de données fonctionnel du projet **LMN24**.

Le site agrège des flux XML/RSS provenant de journaux du monde entier, les parse automatiquement, stocke les articles récupérés et les présente par langue et par catégorie.

---

# 1. Country

Représente un pays utilisé pour rattacher les sources d’actualités et permettre le filtrage des contenus.

| Champ | Type | Obligatoire | Description |
|---|---|---:|---|
| `id` | UUID | Oui | Identifiant unique |
| `name` | String | Oui | Nom du pays, ex. `France` |
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

### Exemple

- name : `France`
- isoCode2 : `FR`
- isoCode3 : `FRA`
- slug : `france`
- isActive : `true`

---

# 2. Language

Représente une langue utilisée par les flux et par les pages d’actualités.

| Champ | Type | Obligatoire | Description |
|---|---|---:|---|
| `id` | UUID | Oui | Identifiant unique |
| `name` | String | Oui | Nom de la langue, ex. `Français` |
| `code` | String | Oui | Code langue, ex. `fr`, `en`, `es` |
| `isActive` | Boolean | Oui | Indique si la langue est active sur le site |
| `createdAt` | DateTime | Oui | Date de création |
| `updatedAt` | DateTime | Oui | Date de modification |

### Contraintes

- `code` doit être unique.

---

# 3. Category

Représente une catégorie d’actualité.

Exemples : Monde, Politique, Économie, Technologie, Sport, Culture, Santé.

| Champ | Type | Obligatoire | Description |
|---|---|---:|---|
| `id` | UUID | Oui | Identifiant unique |
| `name` | String | Oui | Nom fonctionnel de la catégorie |
| `slug` | String | Oui | Identifiant utilisable dans les URL |
| `isActive` | Boolean | Oui | Indique si la catégorie est active |
| `createdAt` | DateTime | Oui | Date de création |
| `updatedAt` | DateTime | Oui | Date de modification |

### Contraintes

- `slug` doit être unique.

> Les libellés affichés dans l’interface seront gérés via les fichiers de traduction multilingues et ne devront pas être codés en dur.

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
| `countryId` | UUID | Oui | Pays principal du journal |
| `isActive` | Boolean | Oui | Active ou désactive la source |
| `createdAt` | DateTime | Oui | Date de création |
| `updatedAt` | DateTime | Oui | Date de modification |

### Relations

- Une `Source` appartient à un `Country`.
- Une `Source` peut posséder plusieurs `Feed`.

### Contraintes

- `slug` doit être unique.
- `websiteUrl` doit être une URL valide.

---

# 5. Feed

Représente un flux XML/RSS provenant d’une `Source`.

| Champ | Type | Obligatoire | Description |
|---|---|---:|---|
| `id` | UUID | Oui | Identifiant unique |
| `sourceId` | UUID | Oui | Journal auquel appartient le flux |
| `categoryId` | UUID | Oui | Catégorie d’actualité |
| `languageId` | UUID | Oui | Langue du flux |
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
| `title` | String | Oui | Titre de l’article |
| `summary` | Text | Non | Résumé fourni par le flux |
| `imageUrl` | String | Non | URL de l’image associée |
| `articleUrl` | String | Oui | URL vers l’article original |
| `publishedAt` | DateTime | Oui | Date et heure de publication de l’article |
| `createdAt` | DateTime | Oui | Date et heure d’enregistrement dans la base |

### Relations

- Un `Article` appartient directement à une `Source`.

### Contraintes

- `articleUrl` doit être unique.
- `publishedAt` correspond à la date fournie par le flux.
- `createdAt` correspond à la date d’import dans LMN24.

---

# 7. Setting

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

#### Nombre d’articles affichés par catégorie

- key : `articlesPerCategory`
- value : `20`
- type : `INTEGER`
- scope : `CATEGORY`

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

---

# 8. User

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

### Contraintes

- `email` doit être unique.
- Le mot de passe ne doit jamais être stocké en clair.
- Seuls les utilisateurs actifs peuvent se connecter.
- Les droits d’accès dépendent du rôle.

### Rôles initiaux

- `ADMIN` : accès complet au paramétrage.
- `EDITOR` : gestion du contenu, des sources et des flux sans administration des utilisateurs.

---

# 9. Vue synthétique des relations

```text
Country
  └── Source
        ├── Feed
        └── Article

Language
  └── Feed

Category
  └── Feed

Setting
  ├── GLOBAL
  ├── CATEGORY
  └── FEED

User
  └── Accès aux interfaces d’administration
```

---

# 10. Principes retenus

- Le modèle doit rester simple pour le MVP.
- Les flux XML/RSS sont rattachés à une source, une langue et une catégorie.
- Les articles sont rattachés directement à leur `Source`. Le pays est hérité via la source. La langue et la catégorie restent définies au niveau du `Feed` utilisé lors de l’import, sans relation persistée entre `Article` et `Feed`.
- Les paramètres techniques et fonctionnels doivent être configurables sans modifier le code.
- Les traductions de l’interface seront stockées dans des fichiers multilingues séparés.
- Les données techniques de supervision du parseur sont stockées sur `Feed`.
- Les mots de passe sont stockés uniquement sous forme de hash.
