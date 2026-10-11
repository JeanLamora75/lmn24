# SCRUM-28 — Activer le néerlandais dans LMN24

La huitième locale est **`nl`** (Nederlands). Elle est utilisable sur
`/nl` et `/nl/category/<slug>` et dans le sélecteur de langue du site.

## Mettre à jour une base PostgreSQL existante

Le changement de référence SQL **n'est pas appliqué automatiquement par un `git pull`**.
Dans le dossier racine du projet, exécuter :

```powershell
psql -U <utilisateur_postgresql> -d <nom_de_la_base> -f database/migrations/007_add_dutch_language.sql
```

Si le binaire `psql` n'est pas dans le PATH, utiliser son chemin complet.
Le script est idempotent : il crée `language.iso_code2 = 'nl'` si absent
ou réactive cette langue si elle existait en inactif, sans altérer les sept
autres langues. Il ne change **ni schéma ni table**.

Vérification :

```sql
SELECT iso_code2, is_active FROM language WHERE iso_code2 = 'nl';
```

Pour une **nouvelle installation**, `database/seed_language.sql` insère
également `nl` parmi les langues activées.

## Redémarrage et test

1. Mettre à jour le dépôt (`git checkout main` puis `git pull origin main`).
2. Exécuter le script ci-dessus sur votre PostgreSQL local.
3. Redémarrer les processus **frontend et backend**.
4. Ouvrir `http://localhost:3000/nl` et `http://localhost:3000/nl/category/sports`.
5. Choisir « Nederlands » dans le menu des langues, avec le drapeau néerlandais.
6. Dans **Admin → Flux RSS/XML → Nouveau flux**, vérifier que `NL` est
   proposé dans la liste des langues, puis vérifier que le parser peut
   récupérer un flux lié à la langue `nl`.

Les pages publiques néerlandaises n'affichent que les articles
`Article.languageIsoCode2 = 'nl'` ; elles restent vides tant qu'aucun
article néerlandophone n'a été ingéré. **Aucune traduction automatique
des titres ou des articles** n'est effectuée.

La langue par défaut globale reste inchangée (`fr` à l'initialisation).
Les médias d'une source conservent le drapeau de leur **pays**, qui ne
dépend pas de la langue choisie.
