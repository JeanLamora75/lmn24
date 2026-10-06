# @lmn24/database

Shared database package for LMN24.

## Responsibilities

- Prisma schema
- Prisma configuration
- generated Prisma Client
- shared PostgreSQL access for the backend and parser
- Prisma migrations

## Local configuration

Copy `.env.example` to `.env` and configure `DATABASE_URL`.

## Commands

```bash
pnpm prisma:validate
pnpm prisma:format
pnpm prisma:generate
pnpm prisma:migrate:dev
pnpm prisma:migrate:deploy
pnpm prisma:studio
```

All Prisma migrations must be created and managed from this package.
