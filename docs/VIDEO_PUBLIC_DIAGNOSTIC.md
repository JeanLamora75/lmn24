# Diagnostic de visibilité des vidéos publiques (SCRUM-43)

Cette procédure **ne modifie aucune donnée**. Elle est utile si des vidéos collectées restent invisibles dans une langue donnée après mise à jour de LMN24.

## 1. Nombre de vidéos par langue et raison éventuelle de masquage

Dans `psql` ou Prisma Studio (requête SQL), exécuter :

```sql
SELECT
    TRIM(v.language_iso_code2) AS langue,
    COUNT(*) AS videos_collectees,
    COUNT(*) FILTER (WHERE v.is_published) AS videos_publiees,
    COUNT(*) FILTER (WHERE NOT v.is_published) AS videos_masquees,
    COUNT(*) FILTER (WHERE v.is_published AND c.is_active) AS visibles_sur_le_site,
    COUNT(*) FILTER (WHERE v.is_published AND NOT c.is_active) AS masquees_par_categorie,
    COUNT(*) FILTER (WHERE v.is_published AND NOT s.is_active) AS publiees_source_inactive
FROM video v
JOIN category c ON c.id = v.category_id
JOIN source s ON s.id = v.source_id
GROUP BY TRIM(v.language_iso_code2)
ORDER BY langue;
```

Une vidéo est visible dans l'API publique si elle est **publiée** (`video.is_published = true`) et que sa **catégorie est active**. Le statut administratif actif/inactif de la source ne bloque plus une vidéo explicitement publiée, conformément aux articles de la page d'accueil.

Si `visibles_sur_le_site = 0`, le problème est une absence de vidéos publiées pour cette langue (ou une catégorie désactivée), pas un problème de filtre de la page.

## 2. Vérifier l'état des derniers flux YouTube et des imports

```sql
SELECT
    TRIM(f.language_iso_code2) AS langue,
    s.name AS source,
    f.is_active AS flux_actif,
    f.last_fetch_status AS dernier_statut,
    f.last_error AS derniere_erreur,
    COUNT(v.id) AS videos_en_base
FROM feed_video f
JOIN source s ON s.id = f.source_id
LEFT JOIN video v ON v.feed_video_id = f.id
GROUP BY f.id, f.language_iso_code2, s.name, f.is_active, f.last_fetch_status, f.last_error
ORDER BY langue, source;
```

**Attention :** le nombre de vidéos en base reflète la persistance. Un flux peut avoir `last_fetch_status = SUCCESS` mais `videos_en_base = 0` (aucune vidéo importée, doublons ou flux vide).

## 3. Distinguer un problème de données d'un problème HTTP

Sans authentification, tester les endpoints publics du backend local :

```text
http://localhost:3001/public/videos?locale=fr
http://localhost:3001/public/videos?locale=en
http://localhost:3001/public/videos?locale=de
http://localhost:3001/public/videos?locale=pt
http://localhost:3001/public/videos?locale=es
```

Si la réponse API contient des `items` dans une langue, la galerie doit les afficher sur `http://localhost:3000/<langue>/videos`. Si les `items` sont vides mais les données SQL sont visibles, inspecter les erreurs backend et les différences de connexion `DATABASE_URL` entre backend et parser.

**Ne pas publier d'URL de connexion, d'identifiants ou de secrets présents dans les journaux.**
