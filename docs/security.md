# Security

## Threat model

SaveMarks assumes a single user. The web application and locally served media
are protected by HTTP Basic authentication, while the extension uses its own
revocable bearer token. It still treats source pages, captured responses, media
servers, extension messages, and API callers as untrusted. Compromise of the
browser profile or Unraid host is outside the protection boundary.

## Permissions

The extension has `storage` and `alarms`, plus host access limited to X,
Twitter, and Instagram. It does not request `cookies`, web-wide content-script
access, or webRequest interception. A server origin is requested as an optional
permission only when the user pairs a configured URL; Chrome requires broad
optional HTTP/HTTPS patterns in the manifest to support an arbitrary LAN or
Tailscale hostname, but no such origin is granted silently.

## Authentication data

The production Compose configuration refuses to serve the library until
`SAVEMARKS_WEB_USERNAME` and `SAVEMARKS_WEB_PASSWORD` are configured. The
browser keeps the resulting HTTP Basic session; the password is never given to
the extension. Use HTTPS whenever traffic can leave a fully trusted LAN because
Basic credentials are only encoded—not encrypted—on plain HTTP.

The page bridge never reads or emits cookies, authorization headers, CSRF
tokens, session identifiers, or complete request headers. Source credentials
never leave the source tab. Debug capture stores field names rather than response
values and recursively redacts sensitive request-body keys.

The X historical importer reuses the browser's observed request headers only
inside the page's in-memory bridge. Those headers are never posted across the
extension message boundary, written to extension storage, logged, exported, or
sent to the SaveMarks server.

The pairing API returns a 256-bit random token once. The extension stores it in
`chrome.storage.local`. PostgreSQL stores only a SHA-256 digest combined with a
server-side pepper. Pairing codes use an unambiguous eight-character alphabet,
expire after five minutes, and are single-use.

## CORS and local network

In production, API CORS responses are emitted only for extension IDs and origins
configured by the operator. In local development only, when no extension ID is
configured, SaveMarks accepts syntactically valid Chrome extension origins to
keep first-run setup simple. Pairing still requires a short-lived, single-use
code. Pairing fails for every other unlisted browser origin.
Running over plain HTTP is acceptable only on a trusted private network; use a
Tailscale HTTPS hostname when the local network is not trusted.
The extension enforces HTTPS for remote hostnames and permits plain HTTP only
for loopback, private IP ranges, link-local addresses, and `.local` names. It
requests runtime access only to the normalized server origin selected during
pairing; Chrome displays the corresponding host-permission prompt.

Pairing code creation and exchange are rate limited per client address. JSON
endpoints reject malformed and oversized bodies, mutable web endpoints require
same-origin requests, and responses include a restrictive Content Security
Policy, clickjacking protection, MIME sniffing protection, and a locked-down
browser permissions policy.

## Redaction and fixtures

Diagnostics is explicit opt-in and bounded. Exports contain URLs, operation
names, status codes, field paths, and cursor paths—not raw response values or
headers. Run `npm run fixtures:check` and manually inspect every fixture before
commit. Production raw-payload storage is disabled; the debug table stores only
field shapes and is unused by default.

## Media validation

The media downloader enforces byte limits, allowlists source CDN hostnames and
MIME types, validates every redirect, and caps redirect counts. Paths derive
only from SHA-256 and server-selected extensions, and traversal-safe resolution
keeps every file below `MEDIA_DATA_PATH`. X media is accepted only from
`pbs.twimg.com` and `video.twimg.com`; Instagram media is limited to Instagram
and Facebook CDN hostnames.

## Operational requirements

Set a unique `POSTGRES_PASSWORD`, web password, and random
`SAVEMARKS_TOKEN_PEPPER`, keep
Unraid volumes private, back up PostgreSQL and media together, and revoke the
extension client after a lost browser profile. Detailed logs must pass through
the shared redactor and must not contain stack traces in user-facing responses.

The web container uses a read-only root filesystem, a bounded temporary
filesystem, a PID limit, and only the Linux capabilities needed by the startup
entrypoint to assign ownership of `/data` before dropping to the configured
Unraid UID/GID. PostgreSQL is not exposed on the host network.
