# Instagram extraction spike

## Status

**Not live-validated.** No private endpoint, query identifier, response field
mapping, collection mapping, or pagination behavior is invented in this
repository.

## Implemented and verified locally

- Diagnostics is limited to `www.instagram.com` and disabled by default.
- Fetch/XHR JSON is reduced to field paths inside the page before crossing the
  extension boundary.
- Relevant save/cursor signals can be filtered and exported as a sanitized
  fixture.
- Sanitized templates exclude headers and redact sensitive body keys.
- The Instagram adapter fails closed until an observed schema mapper exists.

## Required live verification

Using the user's normal authenticated Instagram tab:

1. Enable diagnostics and clear previous events.
2. Save an image, video, reel, and carousel where possible.
3. Open Saved, enter a collection if used, and request another page.
4. Verify the observed response supplies shortcode/platform ID, author, caption,
   media candidates, type, collection, and cursor.
5. Export, inspect, and scan a minimal fixture.
6. Add contract tests and the mapper from that observed schema.
7. Test a single fixed credentialed replay command in an open Instagram tab.
8. Send one normalized item to the local API.

## Fallback

Background reliability is unverified. The initial safe assumption is that
credentialed replay may require an open Instagram tab. If service-worker replay
cannot be proven reliable without cookie access, SaveMarks will retain this
open-tab fallback and will not request the `cookies` permission.

## Known failure modes

Checkpoint replay stops on authentication errors, 401/403, 429, expired request
templates, schema mismatch, or anti-abuse interstitials. SaveMarks does not solve
CAPTCHAs or retry aggressively.
