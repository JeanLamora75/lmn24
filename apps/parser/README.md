# Parser

Service RSS/XML indépendant de LMN24.

## Stack initiale

- Node.js + TypeScript
- rss-parser
- node-cron
- Pino
- accès PostgreSQL partagé via `@lmn24/database`

Le squelette n'implémente volontairement pas encore les règles métier d'import. Elles seront développées à partir du backlog Jira.

## Endpoint initial

- `GET /health`

## Commandes

```bash
pnpm --filter @lmn24/parser dev
pnpm --filter @lmn24/parser build
pnpm --filter @lmn24/parser lint
pnpm --filter @lmn24/parser typecheck
pnpm --filter @lmn24/parser test
```

Port par défaut : `3002`, configurable avec `PARSER_PORT`.
