# Backend

API REST NestJS de LMN24.

## Socle initial

- NestJS 12
- configuration via variables d'environnement
- logs structurés avec Pino
- CORS explicite
- Swagger/OpenAPI sur `/docs`
- health check sur `/health`

## Commandes

```bash
pnpm --filter @lmn24/backend dev
pnpm --filter @lmn24/backend build
pnpm --filter @lmn24/backend lint
pnpm --filter @lmn24/backend typecheck
pnpm --filter @lmn24/backend test
```

Port par défaut : `3001`, configurable avec `BACKEND_PORT`.

## Recherche des identifiants YouTube (`@handle`)

La recherche des identifiants depuis l'administration utilise en priorité
l'API officielle **YouTube Data API v3** lorsqu'une clé est configurée.
Cela évite de dépendre des métadonnées HTML des pages, que YouTube peut limiter
ou refuser pour un navigateur automatisé.

1. Dans Google Cloud Console, créez/sélectionnez un projet, activez **YouTube Data API v3** et créez une clé API.
2. Ajoutez `YOUTUBE_API_KEY="votre_cle"` dans le fichier `.env` à la racine du monorepo (ne commitez jamais la vraie clé).
3. Redémarrez **le backend** puis cliquez sur **Rechercher** dans l'écran `/admin/video-feeds/new`.
4. Si la clé ne peut pas être utilisée (quota, autorisation, réseau), LMN24 essaie encore l'extraction HTML existante et propose la saisie manuelle.

L'endpoint utilisé est `GET https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=@nom`.
D'après la documentation de Google, `channels.list` coûte **1 unité de quota** par appel.
La clé est employée uniquement par NestJS, pas par Next.js ni le navigateur.
Une clé API destinée au serveur doit autoriser **YouTube Data API v3**, avec
des restrictions adaptées au réseau et à l'hébergement du backend.

Aucune clé n'est nécessaire si un identifiant de chaîne `UC...` complet est déjà connu.
Aucune migration PostgreSQL n'est requise.
