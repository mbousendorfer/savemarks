# SaveMarks architecture

## Current milestone boundary

This repository implements the Milestone 0 foundation and the tooling needed to
run Milestone 1. The visual library is intentionally not implemented. X and
Instagram adapters remain fail-closed until sanitized live captures verify their
schemas.

## Components

- `apps/extension` is the Manifest V3 client. It observes supported source tabs,
  keeps diagnostics and request templates locally, queues normalized items in
  IndexedDB, and sends only validated normalized bookmarks to SaveMarks.
- `apps/web` is the local Next.js service. It exposes health, pairing, and
  bookmark-ingest endpoints.
- `packages/extraction` owns source adapters, capture sanitization, field-shape
  inspection, cursor discovery, and template validation.
- `packages/shared` owns all Zod contracts and normalization utilities.
- `packages/database` owns the Drizzle schema and content-addressed media-path
  rules.

## Extension boundaries

```text
supported source page
  -> fixed MAIN-world observation bridge
  -> window.postMessage with a versioned, narrow message
  -> isolated content script validates with Zod
  -> service worker
  -> IndexedDB queue
  -> paired local SaveMarks API
```

The MAIN-world bridge cannot execute arbitrary code and does not expose a generic
network method. Captured response values are reduced to field paths before they
cross the page boundary. Raw headers are never captured.

Credentialed pagination replay is designed to occur in the page context through
a future fixed adapter command, after live request templates are verified. The
current bridge does not replay requests.

## Local storage

- `chrome.storage.local`: server URL, API token, sync settings, bounded diagnostic
  metadata, and bounded sanitized templates.
- extension IndexedDB: persistent normalized-bookmark retry queue.
- PostgreSQL: normalized library metadata and token hashes.
- `/data/media`: content-addressed media bytes.
- `/data/backups`: operator-managed database and media backups.

## Synchronization state

Queue items progress from pending to server ingestion. A failed item stores a
redacted error, retry count, and next retry time. Exponential backoff is capped at
six hours. Authentication and rate-limit responses stop the current flush.
Periodic alarms default to 15 minutes and survive service-worker suspension.

Source pagination and historical import checkpoints will be added only after the
live spike confirms cursor placement and request replay behavior.

## Media flow

The database already records source URL, MIME type, dimensions, content hash,
local path, and status. The first planned download path is server-side CDN fetch.
If a CDN requires the browser session, the extension will upload bytes without
cookies. The storage helper accepts an allowlisted MIME type, derives the
extension, shards by SHA-256, and blocks path traversal.

## Unraid deployment

`infrastructure/docker-compose.yml` runs the standalone Next.js server and
PostgreSQL. Host paths default to `/data/postgres`, `/data/media`, and
`/data/backups`, and all are configurable. Port 3210 is exposed by default for
`http://scarif.local:3210` or a configured Tailscale hostname. The web image
bundles the committed Drizzle migrations and applies them before starting the
Next.js process.
