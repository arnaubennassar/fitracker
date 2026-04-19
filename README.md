# Fitracker

Phase 3 backend foundation for a `pnpm` monorepo with a Fastify backend, a Next.js frontend, SQLite persistence, committed migrations, deterministic seed data, and an admin API for catalog, template authoring, assignments, and reporting.

## Requirements

- Node.js 22+
- `pnpm` 10+

## Local startup

```bash
pnpm install
cp .env.example .env
pnpm --filter @fitracker/backend migrate
pnpm --filter @fitracker/backend seed
pnpm dev
```

- Frontend: `http://localhost:3000`
- Backend health: `http://localhost:3001/health`
- Backend docs: `http://localhost:3001/docs`
- OpenAPI JSON: `http://localhost:3001/openapi.json`

## Seeded local access

- Seeded user: `Arnau`
- Seeded admin bearer token: value from `ADMIN_SEED_TOKEN` in `.env`

Example:

```bash
curl -H "Authorization: Bearer $ADMIN_SEED_TOKEN" \
  http://localhost:3001/api/v1/admin/session
```

## Phase 3 admin API coverage

Authenticated admin endpoints now cover:

- exercise category CRUD at `/api/v1/admin/categories`
- exercise CRUD plus nested media at `/api/v1/admin/exercises`
- workout template CRUD plus ordered template exercises at `/api/v1/admin/workout-templates`
- assignment CRUD at `/api/v1/admin/assignments`
- reporting for workout sessions and feedback at `/api/v1/admin/reporting/*`

OpenAPI is generated from the registered route schemas and available at both `/openapi.json` and `/api/v1/openapi.json`.

## Checks

```bash
pnpm lint
pnpm test
pnpm typecheck
pnpm build
```

## Docker

```bash
docker compose up --build
```

Local SQLite data defaults to `.data/app.db`. In Docker it is mounted at `/data/app.db`.
