# Manual extraction testing

Automated tests never require a real social account. Live verification is a
manual, local-only activity.

## Before testing

Complete [getting-started.md](getting-started.md) first. In particular:

1. run `pnpm setup`;
2. load `apps/extension/build` as an unpacked extension;
3. add its ID to `SAVEMARKS_ALLOWED_EXTENSION_IDS` in `.env`;
4. run `pnpm dev`;
5. pair the extension and confirm `/api/health` is reachable.

## Diagnostics safety check

Diagnostics must initially be off. Turn it on only while testing a supported tab.
Open the diagnostics page, clear it, perform one targeted action, turn
diagnostics off, and inspect every event. Confirm there are no headers, cookie
values, CSRF values, session IDs, personal post text, captions, or media URLs.

## X spike checklist

- Newly bookmark one post and confirm a save hint.
- Confirm canonical ID/URL, text, author, media, quote, and any conversation
  structure can be located in the observed schema.
- Load one more bookmark page and confirm a cursor path.
- Export a minimal fixture, run `pnpm fixtures:check`, and inspect it manually.
- Only then implement/test the X mapper and one-page replay.

## Instagram spike checklist

- Save representative image, video, reel, and carousel posts.
- Confirm shortcode/platform ID, type, caption, author, media candidates, and
  source collection can be located when present.
- Load one more Saved page and confirm a cursor path.
- Export, scan, and inspect a minimal fixture.
- Only then implement/test the Instagram mapper and one-page replay.

## Stop conditions

Stop immediately on 401, 403, 429, CAPTCHA/anti-abuse UI, unexpected response
shape, or any captured secret. Delete unsafe local diagnostics, fix redaction,
and do not commit the capture.

## Pairing and outage checks

- Reuse and expiry of a pairing code must fail.
- Revoked tokens must receive 401.
- With Scarif stopped, enqueue a normalized test item, restart the browser, and
  confirm the IndexedDB item remains.
- Restore the server and confirm the queue drains without duplicates.
