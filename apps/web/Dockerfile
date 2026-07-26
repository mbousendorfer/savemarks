FROM node:22-alpine AS base
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
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs
COPY --from=build --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=nextjs:nodejs /app/migrate.mjs ./migrate.mjs
COPY --from=build --chown=nextjs:nodejs /app/packages/database/drizzle ./drizzle
USER nextjs
EXPOSE 3210
ENV PORT=3210
CMD ["sh", "-c", "node /app/migrate.mjs && node apps/web/server.js"]
