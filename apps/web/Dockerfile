FROM node:22-alpine AS base
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

FROM base AS dependencies
COPY package.json package-lock.json turbo.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/extension/package.json apps/extension/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/extraction/package.json packages/extraction/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci

FROM dependencies AS build
COPY . .
RUN npm run build --workspace=@savemarks/web
RUN npx --no-install esbuild packages/database/src/migrate.ts \
  --bundle \
  --platform=node \
  --format=esm \
  --outfile=/app/migrate.mjs

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
RUN apk add --no-cache su-exec
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/migrate.mjs ./migrate.mjs
COPY --from=build /app/packages/database/drizzle ./drizzle
COPY infrastructure/docker-entrypoint.sh /usr/local/bin/savemarks-entrypoint
EXPOSE 3210
ENV PORT=3210
ENV HOSTNAME=0.0.0.0
ENTRYPOINT ["savemarks-entrypoint"]
