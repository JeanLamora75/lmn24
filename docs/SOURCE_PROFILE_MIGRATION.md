# SCRUM-29 — Enrichissement des sources / journaux

Le formulaire **Admin → Sources / Journaux → Ajouter ou Modifier** expose
désormais une section **Présentation et réseaux sociaux** avec six champs
facultatifs : page RSS, Facebook, X/Twitter, Instagram, YouTube et description.

Le lien **Page RSS** est informatif : il ne crée aucun flux `Feed` ni article.
La description est un texte brut, de 5 000 caractères maximum. Les URL sont
validées côté interface et côté API, limitées à 2 048 caractères, avec une
vérification du nom de domaine pour chaque réseau social.

## Mise à niveau de PostgreSQL existant — obligatoire

Après `git checkout main` et `git pull origin main`, exécuter depuis
le dossier racine de LMN24 :

```powershell
psql -U "VOTRE_UTILISATEUR_POSTGRESQL" -d "VOTRE_BASE" -f "database/migrations/008_source_profile_links.sql"
```

Si PostgreSQL portable est utilisé, appeler directement son `psql.exe`
avec son chemin absolu.

Le script est **idempotent** et ajoute six colonnes `TEXT NULL` via
`ALTER TABLE source ADD COLUMN IF NOT EXISTS`. Aucun contenu existant
n'est effacé et aucune migration des flux ou articles n'est nécessaire.

Pour vérifier :

```sql
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'source'
  AND column_name IN (
    'rss_page_url', 'facebook_url', 'x_url',
    'instagram_url', 'youtube_url', 'description'
  )
ORDER BY column_name;
```

La requête doit renvoyer six lignes.

## Démarrage et test

1. Mettre à jour le dépôt depuis la branche `main`.
2. Appliquer le SQL ci-dessus **avant de démarrer le backend mis à jour**.
3. Régénérer le client Prisma : `pnpm db:generate`, à la racine.
4. Redémarrer le backend et le frontend.
5. Depuis `http://localhost:3000/admin/sources`, créer une source avec une
   URL Facebook, une page RSS et une description ; enregistrer.
6. Réouvrir la fiche en modification pour vérifier le préremplissage.
7. Effacer uniquement le champ Facebook ; enregistrer et vérifier que
   la description et le lien RSS sont conservés.
8. Vérifier qu'une URL de réseau social hors de son domaine officiel est
   refusée et qu'une source sans aucune donnée additionnelle reste valide.

Les six nouveaux champs sont retournés par les API d'administration
`GET /admin/sources` et `GET /admin/sources/:id`. La création, la
modification, la capture d'image, les imports RSS/XML et la suppression de
source restent protégés par les mécanismes d'authentification existants.

Les champs n'apparaissent pas encore sur les pages publiques des sources :
ce sera l'objet d'une future Story.
