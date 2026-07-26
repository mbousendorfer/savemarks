# X extraction spike

## Status

**Not live-validated.** No endpoint path, GraphQL operation identifier, request
hash, response field mapping, or pagination behavior is claimed as implemented.

## Implemented and verified locally

- Diagnostics runs only on `x.com` and `twitter.com` source tabs.
- It observes fetch and XHR only after explicit enablement.
- It records sanitized URL, method, status, optional observed operation name,
  field paths, mutation hints, and cursor-like field paths.
- It can retain a bounded sanitized request template locally when an observed
  response exposes a cursor-shaped field.
- Adapter template validation rejects another source, another host, and visible
  authentication material.

## Required live verification

Using the user's normal authenticated X tab:

1. Enable diagnostics and clear old events.
2. Bookmark a post with text, author, media, and a quote if available.
3. Open the user's bookmarks view and load another page.
4. Confirm diagnostics detected the save and a cursor without retaining content.
5. Export, inspect, and scan the sanitized fixture.
6. Implement the X mapper against only that fixture.
7. Add a fixed page-context replay command and verify one additional page.
8. Send one normalized item to the paired local API.

Threads are represented only if the observed response supplies a stable
conversation structure. DOM extraction may be used as a narrow fallback for a
currently visible item, never as the sole historical-sync mechanism.

## Known failure modes

Authentication errors, 401/403, 429, missing templates, expired operations, and
unexpected field shapes must halt X synchronization. Changes must produce
`SCHEMA_CHANGED`, not partial data. No CAPTCHA or rate-limit bypass is permitted.
