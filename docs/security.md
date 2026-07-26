# Security

## Threat model

SaveMarks assumes a trusted single user and an authenticated private LAN or
Tailscale network. It still treats source pages, captured responses, media
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

The page bridge never reads or emits cookies, authorization headers, CSRF
tokens, session identifiers, or complete request headers. Source credentials
never leave the source tab. Debug capture stores field names rather than response
values and recursively redacts sensitive request-body keys.

The pairing API returns a 256-bit random token once. The extension stores it in
`chrome.storage.local`. PostgreSQL stores only a SHA-256 digest combined with a
server-side pepper. Pairing codes use an unambiguous eight-character alphabet,
expire after five minutes, and are single-use.

## CORS and local network

API CORS responses are emitted only for extension IDs and development origins
configured by the operator. Pairing fails for an unlisted browser origin.
Running over plain HTTP is acceptable only on a trusted private network; use a
Tailscale HTTPS hostname when the local network is not trusted.

## Redaction and fixtures

Diagnostics is explicit opt-in and bounded. Exports contain URLs, operation
names, status codes, field paths, and cursor paths—not raw response values or
headers. Run `npm run fixtures:check` and manually inspect every fixture before
commit. Production raw-payload storage is disabled; the debug table stores only
field shapes and is unused by default.

## Media validation

Media work must enforce byte limits before buffering, allowlist MIME types,
verify magic bytes, reject redirects outside HTTP(S), and cap redirect counts.
Paths derive only from verified SHA-256 and server-selected extensions. The
current foundation implements hashing and traversal-safe path resolution; the
network downloader is not yet enabled.

## Operational requirements

Set a unique `POSTGRES_PASSWORD` and a random `SAVEMARKS_TOKEN_PEPPER`, keep
Unraid volumes private, back up PostgreSQL and media together, and revoke the
extension client after a lost browser profile. Detailed logs must pass through
the shared redactor and must not contain stack traces in user-facing responses.
