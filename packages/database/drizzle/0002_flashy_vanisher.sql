CREATE INDEX "bookmarks_source_saved_idx" ON "bookmarks" USING btree ("source","saved_at");--> statement-breakpoint
CREATE INDEX "bookmarks_read_later_status_idx" ON "bookmarks" USING btree ("source","archived","read_at","saved_at");--> statement-breakpoint
CREATE INDEX "media_assets_sync_queue_idx" ON "media_assets" USING btree ("status","created_at");