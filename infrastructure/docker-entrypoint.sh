#!/bin/sh
set -eu

PUID="${PUID:-99}"
PGID="${PGID:-100}"

case "${PUID}:${PGID}" in
  *[!0-9:]* | :* | *:)
    echo "PUID and PGID must be numeric." >&2
    exit 1
    ;;
esac

mkdir -p /data/media /data/backups
chown "${PUID}:${PGID}" /data /data/media /data/backups

su-exec "${PUID}:${PGID}" node /app/migrate.mjs
exec su-exec "${PUID}:${PGID}" node apps/web/server.js
