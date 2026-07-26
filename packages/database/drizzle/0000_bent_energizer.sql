CREATE TYPE "public"."content_type" AS ENUM('text', 'image', 'video', 'carousel', 'reel', 'thread', 'quote');--> statement-breakpoint
CREATE TYPE "public"."media_status" AS ENUM('pending', 'downloading', 'stored', 'failed');--> statement-breakpoint
CREATE TYPE "public"."source" AS ENUM('x', 'instagram');--> statement-breakpoint
CREATE TABLE "authors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" "source" NOT NULL,
	"source_id" varchar(512),
	"username" varchar(256) NOT NULL,
	"display_name" varchar(512),
	"profile_url" text,
	"avatar_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "authors_source_username_unique" UNIQUE("source","username")
);
--> statement-breakpoint
CREATE TABLE "bookmark_local_collections" (
	"bookmark_id" uuid NOT NULL,
	"collection_id" uuid NOT NULL,
	CONSTRAINT "bookmark_local_collections_bookmark_id_collection_id_pk" PRIMARY KEY("bookmark_id","collection_id")
);
--> statement-breakpoint
CREATE TABLE "bookmark_source_collections" (
	"bookmark_id" uuid NOT NULL,
	"collection_id" uuid NOT NULL,
	CONSTRAINT "bookmark_source_collections_bookmark_id_collection_id_pk" PRIMARY KEY("bookmark_id","collection_id")
);
--> statement-breakpoint
CREATE TABLE "bookmark_tags" (
	"bookmark_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "bookmark_tags_bookmark_id_tag_id_pk" PRIMARY KEY("bookmark_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "bookmarks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" "source" NOT NULL,
	"source_item_id" varchar(512) NOT NULL,
	"canonical_url" text NOT NULL,
	"normalized_url_hash" varchar(64) NOT NULL,
	"content_type" "content_type" NOT NULL,
	"text" text,
	"caption" text,
	"author_id" uuid NOT NULL,
	"published_at" timestamp with time zone,
	"saved_at" timestamp with time zone,
	"imported_at" timestamp with time zone NOT NULL,
	"raw_schema_version" varchar(128) NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookmarks_source_item_unique" UNIQUE("source","source_item_id")
);
--> statement-breakpoint
CREATE TABLE "development_debug_payloads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" "source" NOT NULL,
	"field_shape" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "extension_clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(128) NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"revoked_at" timestamp with time zone,
	"last_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "extension_clients_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "local_collections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(512) NOT NULL,
	"mapped_source_collection_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bookmark_id" uuid NOT NULL,
	"sha256" varchar(64),
	"mime_type" varchar(256),
	"file_size" bigint,
	"width" integer,
	"height" integer,
	"duration_seconds" integer,
	"source_url" text NOT NULL,
	"local_relative_path" text,
	"position" integer NOT NULL,
	"status" "media_status" DEFAULT 'pending' NOT NULL,
	"failure_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_assets_sha256_unique" UNIQUE("sha256")
);
--> statement-breakpoint
CREATE TABLE "notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bookmark_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notes_bookmark_id_unique" UNIQUE("bookmark_id")
);
--> statement-breakpoint
CREATE TABLE "pairing_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pairing_codes_code_hash_unique" UNIQUE("code_hash")
);
--> statement-breakpoint
CREATE TABLE "source_collections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" "source" NOT NULL,
	"source_id" varchar(512),
	"name" varchar(512) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "source_collections_source_id_unique" UNIQUE("source","source_id")
);
--> statement-breakpoint
CREATE TABLE "sync_errors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sync_run_id" uuid NOT NULL,
	"code" varchar(64) NOT NULL,
	"message" text NOT NULL,
	"recoverable" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" "source" NOT NULL,
	"mode" varchar(32) NOT NULL,
	"status" varchar(32) NOT NULL,
	"cursor" text,
	"imported_count" integer DEFAULT 0 NOT NULL,
	"duplicate_count" integer DEFAULT 0 NOT NULL,
	"skipped_count" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(256) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tags_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "bookmark_local_collections" ADD CONSTRAINT "bookmark_local_collections_bookmark_id_bookmarks_id_fk" FOREIGN KEY ("bookmark_id") REFERENCES "public"."bookmarks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookmark_local_collections" ADD CONSTRAINT "bookmark_local_collections_collection_id_local_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."local_collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookmark_source_collections" ADD CONSTRAINT "bookmark_source_collections_bookmark_id_bookmarks_id_fk" FOREIGN KEY ("bookmark_id") REFERENCES "public"."bookmarks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookmark_source_collections" ADD CONSTRAINT "bookmark_source_collections_collection_id_source_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."source_collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookmark_tags" ADD CONSTRAINT "bookmark_tags_bookmark_id_bookmarks_id_fk" FOREIGN KEY ("bookmark_id") REFERENCES "public"."bookmarks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookmark_tags" ADD CONSTRAINT "bookmark_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_author_id_authors_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."authors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "local_collections" ADD CONSTRAINT "local_collections_mapped_source_collection_id_source_collections_id_fk" FOREIGN KEY ("mapped_source_collection_id") REFERENCES "public"."source_collections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_bookmark_id_bookmarks_id_fk" FOREIGN KEY ("bookmark_id") REFERENCES "public"."bookmarks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_bookmark_id_bookmarks_id_fk" FOREIGN KEY ("bookmark_id") REFERENCES "public"."bookmarks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_errors" ADD CONSTRAINT "sync_errors_sync_run_id_sync_runs_id_fk" FOREIGN KEY ("sync_run_id") REFERENCES "public"."sync_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bookmarks_normalized_url_hash_idx" ON "bookmarks" USING btree ("normalized_url_hash");--> statement-breakpoint
CREATE INDEX "bookmarks_saved_at_idx" ON "bookmarks" USING btree ("saved_at");--> statement-breakpoint
CREATE INDEX "media_assets_bookmark_idx" ON "media_assets" USING btree ("bookmark_id");