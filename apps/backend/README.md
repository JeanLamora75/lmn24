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
