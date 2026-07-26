# Sanitized extraction fixtures

Only exports produced by the SaveMarks diagnostics screen belong here. Before
committing a fixture:

1. confirm diagnostics was limited to a supported source tab;
2. inspect the export manually;
3. record its `sourceSchemaDate`;
4. run `pnpm fixtures:check`;
5. ensure the fixture contains shapes and redacted URLs, never headers, cookies,
   request credentials, tokens, personal text, or raw media URLs.

No live fixtures are committed yet. The X and Instagram response schemas remain
unverified until the manual extraction spike is run.
