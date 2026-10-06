# LMN24

LMN24 is a multilingual news aggregator powered by RSS/XML feeds.

## Architecture

The repository is a pnpm + Turborepo monorepo containing:

- `apps/frontend`: Next.js public site and administration
- `apps/backend`: NestJS REST API
- `apps/parser`: RSS/XML parser and scheduler
- `packages/database`: shared Prisma/PostgreSQL package
- `packages/contracts`: shared API contracts
- `packages/config`: shared technical configuration
- `packages/eslint-config`: shared ESLint configuration

See `ARCHITECTURE.md` and `docs/DATA_MODEL.md` for the project references.

## Requirements

- Node.js 24.21.0 LTS
- pnpm 12.10.0
- PostgreSQL

## Install

```bash
pnpm install
```

## Common commands

```bash
pnpm dev
pnpm build
pnpm lint
pnpm test
pnpm typecheck
pnpm db:validate
pnpm db:generate
```

Copy `.env.example` to `.env` and replace placeholder values before local execution.
