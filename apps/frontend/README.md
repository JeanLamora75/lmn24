# Frontend

Application Next.js de LMN24 : site public et future interface `/admin`.

## Stack initiale

- Next.js 16 / App Router
- React 19
- Bootstrap + React-Bootstrap
- next-intl
- TanStack Query
- React Hook Form + Zod

## Commandes

```bash
pnpm --filter @lmn24/frontend dev
pnpm --filter @lmn24/frontend build
pnpm --filter @lmn24/frontend lint
pnpm --filter @lmn24/frontend typecheck
pnpm --filter @lmn24/frontend test
```

Port par défaut : `3000`, configurable avec `FRONTEND_PORT`.
