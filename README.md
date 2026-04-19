# Fitracker

Phase 1 bootstrap for a `pnpm` monorepo with a Fastify backend, a Next.js frontend, shared TypeScript/Biome tooling, and baseline Docker/CI wiring.

## Requirements

- Node.js 22+
- `pnpm` 10+

## Local startup

```bash
pnpm install
cp .env.example .env
pnpm dev
```

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:3001`

## Checks

```bash
pnpm lint
pnpm typecheck
pnpm build
```

## Docker

```bash
docker compose up --build
```

