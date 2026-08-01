CREATE TYPE "public"."enrichment_status" AS ENUM('pending', 'processing', 'complete', 'failed');--> statement-breakpoint
ALTER TYPE "public"."content_type" ADD VALUE 'link';--> statement-breakpoint
ALTER TYPE "public"."source" ADD VALUE 'web';--> statement-breakpoint
CREATE TABLE "web_pages" (
	"bookmark_id" uuid PRIMARY KEY NOT NULL,
	"title" text,
	"description" text,
	"site_name" varchar(512),
	"author" varchar(512),
	"image_url" text,
	"enrichment_status" "enrichment_status" DEFAULT 'pending' NOT NULL,
	"enrichment_attempts" integer DEFAULT 0 NOT NULL,
	"next_retry_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_error" text,
	"enriched_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bookmarks" ALTER COLUMN "author_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "bookmarks" ADD COLUMN "read_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "web_pages" ADD CONSTRAINT "web_pages_bookmark_id_bookmarks_id_fk" FOREIGN KEY ("bookmark_id") REFERENCES "public"."bookmarks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "web_pages_enrichment_queue_idx" ON "web_pages" USING btree ("enrichment_status","next_retry_at");