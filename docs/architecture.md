# SaveMarks architecture

## Current milestone boundary

The local X workflow is implemented end to end: observation, normalization,
historical pagination, PostgreSQL ingestion, and the visual library. The
Instagram adapter remains fail-closed until sanitized live captures verify its
schema.

## Components

- `apps/extension` is the Manifest V3 client. It observes supported source tabs,
  keeps diagnostics and request templates locally, queues normalized items in
  IndexedDB, and sends only validated normalized bookmarks to SaveMarks.
- `apps/web` is the local Next.js service. It renders the bookmark library from
  PostgreSQL and exposes health, pairing, bookmark-ingest, and read-later
  endpoints.
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

Credentialed X pagination replay occurs in the page context through a fixed,
validated adapter command. It uses the observed request template, is paced, and
stops on authentication or rate-limit responses.

## Local storage

- `chrome.storage.local`: server URL, API token, sync settings, bounded diagnostic
  metadata, and bounded sanitized templates.
- extension IndexedDB: persistent, versioned social-bookmark and read-later
  retry queue.
- PostgreSQL: normalized library metadata and token hashes.
- `/data/media`: content-addressed media bytes.
- `/data/backups`: operator-managed database and media backups.

## Synchronization state

Queue items progress from pending to server ingestion. A failed item stores a
redacted error, retry count, and next retry time. Exponential backoff is capped at
six hours. Authentication and rate-limit responses stop the current flush.
Periodic alarms default to 15 minutes and survive service-worker suspension.

The X and Instagram importers persist their cursor and progress so an
interrupted historical import can resume. Instagram replay starts only after a
valid Saved response has supplied an observed request template.

## Media flow

The database records source URL, MIME type, dimensions, content hash, local
path, and status. The server downloads allowlisted CDN media and stores it under
`<source>/media/pictures` or `<source>/media/videos`, using a SHA-256 filename.
The web library serves stored assets through a local media route and keeps the
remote URL only as a fallback while a download is pending.

Read-later links use a durable PostgreSQL enrichment queue. HTML and preview
images are fetched only from public HTTP(S) destinations with pinned DNS,
redirect validation, byte/time limits, and private-network blocking. Preview
images are stored below `web/media/pictures`; article HTML is not archived.

## Unraid deployment

GitHub Actions publishes the web image to GHCR for `linux/amd64`.
`infrastructure/docker-compose.yml` pulls that image and runs it
with PostgreSQL. The host mounts a single application data directory at `/data`;
media lives below `/data/media` and operator backups below `/data/backups`.
PostgreSQL uses a separate host path. Port 3210 is exposed by default for
`http://scarif.local:3210` or a configured Tailscale hostname.

The image accepts `PUID` and `PGID`, prepares the mounted data directories with
those ownership values, applies the committed Drizzle migrations, and then
drops privileges before starting Next.js.
