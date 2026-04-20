FROM node:22-alpine AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

WORKDIR /app

FROM base AS build

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml biome.json tsconfig.base.json ./
COPY apps/backend/package.json apps/backend/tsconfig.json ./apps/backend/

RUN pnpm install --frozen-lockfile

COPY apps/backend ./apps/backend

RUN pnpm --filter @fitracker/backend build
RUN pnpm deploy --legacy --filter @fitracker/backend --prod /prod/backend

FROM node:22-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /prod/backend ./

EXPOSE 3001

CMD ["node", "dist/index.js"]
