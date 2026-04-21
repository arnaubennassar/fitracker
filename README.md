# Fitracker

Backend foundation through Phase 4 for a `pnpm` monorepo with a Fastify backend, a Next.js frontend, SQLite persistence, committed migrations, deterministic seed data, and a cleaned admin/user API surface ready for the Phase 5 frontend MVP.

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
- MCP endpoint: `http://localhost:3001/mcp`

## Seeded local access

- Seeded user: `Arnau`
- Seeded admin bearer token: value from `ADMIN_SEED_TOKEN` in `.env`

Example:

```bash
curl -H "Authorization: Bearer $ADMIN_SEED_TOKEN" \
  http://localhost:3001/api/v1/admin/session
```

## Backend API coverage

Authenticated admin endpoints cover:

- exercise category CRUD at `/api/v1/admin/categories`
- exercise CRUD plus nested media at `/api/v1/admin/exercises`
- workout template CRUD plus ordered template exercises at `/api/v1/admin/workout-templates`
- assignment CRUD at `/api/v1/admin/assignments`
- reporting for workout sessions and feedback at `/api/v1/admin/reporting/*`

User-facing workout execution and feedback endpoints are available under `/api/v1/auth/*` and `/api/v1/me/*`.

The backend also exposes the admin surface as endpoint-mapped MCP tools at `/mcp` on the same port. Tool names match the admin `operationId` values and reuse the existing admin API validation and auth flow internally.

MCP authoring notes:

- Path params must use the exact schema key names exposed by each tool, for example `params.workoutId` for workout-template routes.
- Exercise `trackingMode` is a strict enum: `distance`, `mixed`, `reps`, or `time`.
- `createWorkoutTemplate` supports embedded `body.exercises`, and nested creation is atomic: if any embedded exercise fails validation or insert, the template is not created.
- For workout template rep targets, use either `targetReps` or `targetRepsMin` plus `targetRepsMax`. Omit unused optional target fields or pass `null`.

To configure the MCP admin token in Docker without editing compose env, run:

```bash
docker compose run --rm backend set-admin-auth
```

That command writes the MCP token to the shared data volume and upserts the matching admin token row in SQLite. To provide your own token or label:

```bash
docker compose run --rm backend set-admin-auth \
  --token "replace-with-a-long-random-value" \
  --name "Local MCP Token"
```

If you want the demo dataset as well, use:

```bash
docker compose run --rm backend seed
```

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

For published GHCR images and a server-side compose example, see [docs/deploy-ghcr.md](docs/deploy-ghcr.md).
.
