# Instagram extraction spike

## Status

**Implemented, awaiting a valid live Saved response.** The current Instagram
account returns Instagram’s own “Something went wrong” screen for All posts and
individual collections. A direct read-only Saved feed check returned
`useragent mismatch`; SaveMarks did not retry it with fabricated headers.

## Implemented and verified locally

- Diagnostics is limited to `www.instagram.com` and disabled by default.
- Fetch/XHR JSON is reduced to field paths inside the page before crossing the
  extension boundary.
- Relevant save/cursor signals can be filtered and exported as a sanitized
  fixture.
- Sanitized templates exclude headers and redact sensitive body keys.
- The adapter normalizes the Saved feed `items`/`next_max_id` shape and the
  equivalent GraphQL connection shape.
- Image, video, reel and carousel candidates are mapped to the shared model.
- Historical import waits for a real Saved request, replays it in the open
  Instagram tab at 1.5-second intervals, persists its cursor, and can resume.
- 401, 403 and 429 stop the import immediately.
- Contract tests cover image and reel normalization.

## Required live verification

Using the user's normal authenticated Instagram tab:

1. Enable diagnostics and clear previous events.
2. Save an image, video, reel, and carousel where possible.
3. Open Saved, enter a collection if used, and request another page.
4. Verify the observed response supplies shortcode/platform ID, author, caption,
   media candidates, type, collection, and cursor.
5. Export, inspect, and scan a minimal fixture.
6. Compare the live field paths with the implemented mapper and adjust only if
   the observed schema differs.
7. Test the fixed credentialed replay command in the open Instagram tab.
8. Confirm one normalized item reaches the local API and web library.

## Fallback

Background reliability is unverified. The initial safe assumption is that
credentialed replay may require an open Instagram tab. If service-worker replay
cannot be proven reliable without cookie access, SaveMarks will retain this
open-tab fallback and will not request the `cookies` permission.

## Known failure modes

Checkpoint replay stops on authentication errors, 401/403, 429, expired request
templates, schema mismatch, or anti-abuse interstitials. SaveMarks does not solve
CAPTCHAs or retry aggressively.
