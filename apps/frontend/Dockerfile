FROM node:22-alpine AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

WORKDIR /app

FROM base AS build

COPY package.json pnpm-workspace.yaml biome.json tsconfig.base.json ./
COPY apps/frontend/package.json apps/frontend/tsconfig.json apps/frontend/next-env.d.ts apps/frontend/next.config.ts ./apps/frontend/

RUN pnpm install

COPY apps/frontend ./apps/frontend

RUN pnpm --filter @fitracker/frontend build

FROM node:22-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/apps/frontend/.next/standalone ./
COPY --from=build /app/apps/frontend/.next/static ./apps/frontend/.next/static
COPY --from=build /app/apps/frontend/public ./apps/frontend/public

WORKDIR /app/apps/frontend

EXPOSE 3000

CMD ["node", "server.js"]
