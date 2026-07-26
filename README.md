# SaveMarks

SaveMarks is a private, local-first library for the owner's X bookmarks and
Instagram saved posts. This repository currently contains the foundation and
extraction diagnostics spike—not the full visual library.

## Development

```bash
pnpm install
cp .env.example .env
docker compose -f infrastructure/docker-compose.dev.yml up -d
pnpm db:generate
pnpm db:migrate
pnpm dev
```

Build the extension with `pnpm --filter @savemarks/extension build`, then load
`apps/extension/build` as an unpacked Chromium extension.

Read `docs/manual-testing.md` before enabling extraction diagnostics.
