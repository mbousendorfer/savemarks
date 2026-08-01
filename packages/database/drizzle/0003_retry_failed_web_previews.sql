UPDATE "web_pages"
SET
  "enrichment_status" = 'pending',
  "enrichment_attempts" = 0,
  "next_retry_at" = now(),
  "last_error" = NULL,
  "updated_at" = now()
WHERE
  "enrichment_status" = 'failed'
  AND "last_error" = 'fetch failed';
