import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const sourceEnum = pgEnum("source", ["x", "instagram"]);
export const contentTypeEnum = pgEnum("content_type", [
  "text",
  "image",
  "video",
  "carousel",
  "reel",
  "thread",
  "quote",
]);
export const mediaStatusEnum = pgEnum("media_status", [
  "pending",
  "downloading",
  "stored",
  "failed",
]);

const createdAt = timestamp("created_at", { withTimezone: true })
  .notNull()
  .defaultNow();
const updatedAt = timestamp("updated_at", { withTimezone: true })
  .notNull()
  .defaultNow();

export const authors = pgTable(
  "authors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    source: sourceEnum("source").notNull(),
    sourceId: varchar("source_id", { length: 512 }),
    username: varchar("username", { length: 256 }).notNull(),
    displayName: varchar("display_name", { length: 512 }),
    profileUrl: text("profile_url"),
    avatarUrl: text("avatar_url"),
    createdAt,
    updatedAt,
  },
  (table) => [
    unique("authors_source_username_unique").on(table.source, table.username),
  ],
);

export const bookmarks = pgTable(
  "bookmarks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    source: sourceEnum("source").notNull(),
    sourceItemId: varchar("source_item_id", { length: 512 }).notNull(),
    canonicalUrl: text("canonical_url").notNull(),
    normalizedUrlHash: varchar("normalized_url_hash", { length: 64 }).notNull(),
    contentType: contentTypeEnum("content_type").notNull(),
    text: text("text"),
    caption: text("caption"),
    authorId: uuid("author_id")
      .notNull()
      .references(() => authors.id),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    savedAt: timestamp("saved_at", { withTimezone: true }),
    importedAt: timestamp("imported_at", { withTimezone: true }).notNull(),
    rawSchemaVersion: varchar("raw_schema_version", { length: 128 }).notNull(),
    archived: boolean("archived").notNull().default(false),
    createdAt,
    updatedAt,
  },
  (table) => [
    unique("bookmarks_source_item_unique").on(
      table.source,
      table.sourceItemId,
    ),
    index("bookmarks_normalized_url_hash_idx").on(table.normalizedUrlHash),
    index("bookmarks_saved_at_idx").on(table.savedAt),
  ],
);

export const mediaAssets = pgTable(
  "media_assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookmarkId: uuid("bookmark_id")
      .notNull()
      .references(() => bookmarks.id, { onDelete: "cascade" }),
    sha256: varchar("sha256", { length: 64 }),
    mimeType: varchar("mime_type", { length: 256 }),
    fileSize: bigint("file_size", { mode: "number" }),
    width: integer("width"),
    height: integer("height"),
    durationSeconds: integer("duration_seconds"),
    sourceUrl: text("source_url").notNull(),
    localRelativePath: text("local_relative_path"),
    position: integer("position").notNull(),
    status: mediaStatusEnum("status").notNull().default("pending"),
    failureReason: text("failure_reason"),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("media_assets_bookmark_idx").on(table.bookmarkId),
    unique("media_assets_sha256_unique").on(table.sha256),
  ],
);

export const sourceCollections = pgTable(
  "source_collections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    source: sourceEnum("source").notNull(),
    sourceId: varchar("source_id", { length: 512 }),
    name: varchar("name", { length: 512 }).notNull(),
    createdAt,
    updatedAt,
  },
  (table) => [
    unique("source_collections_source_id_unique").on(
      table.source,
      table.sourceId,
    ),
  ],
);

export const localCollections = pgTable("local_collections", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 512 }).notNull(),
  mappedSourceCollectionId: uuid("mapped_source_collection_id").references(
    () => sourceCollections.id,
    { onDelete: "set null" },
  ),
  createdAt,
  updatedAt,
});

export const bookmarkSourceCollections = pgTable(
  "bookmark_source_collections",
  {
    bookmarkId: uuid("bookmark_id")
      .notNull()
      .references(() => bookmarks.id, { onDelete: "cascade" }),
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => sourceCollections.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.bookmarkId, table.collectionId] }),
  ],
);

export const bookmarkLocalCollections = pgTable(
  "bookmark_local_collections",
  {
    bookmarkId: uuid("bookmark_id")
      .notNull()
      .references(() => bookmarks.id, { onDelete: "cascade" }),
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => localCollections.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.bookmarkId, table.collectionId] }),
  ],
);

export const tags = pgTable("tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 256 }).notNull().unique(),
  createdAt,
});

export const bookmarkTags = pgTable(
  "bookmark_tags",
  {
    bookmarkId: uuid("bookmark_id")
      .notNull()
      .references(() => bookmarks.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.bookmarkId, table.tagId] })],
);

export const notes = pgTable("notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  bookmarkId: uuid("bookmark_id")
    .notNull()
    .unique()
    .references(() => bookmarks.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  createdAt,
  updatedAt,
});

export const syncRuns = pgTable("sync_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  source: sourceEnum("source").notNull(),
  mode: varchar("mode", { length: 32 }).notNull(),
  status: varchar("status", { length: 32 }).notNull(),
  cursor: text("cursor"),
  importedCount: integer("imported_count").notNull().default(0),
  duplicateCount: integer("duplicate_count").notNull().default(0),
  skippedCount: integer("skipped_count").notNull().default(0),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const syncErrors = pgTable("sync_errors", {
  id: uuid("id").primaryKey().defaultRandom(),
  syncRunId: uuid("sync_run_id")
    .notNull()
    .references(() => syncRuns.id, { onDelete: "cascade" }),
  code: varchar("code", { length: 64 }).notNull(),
  message: text("message").notNull(),
  recoverable: boolean("recoverable").notNull(),
  createdAt,
});

export const extensionClients = pgTable("extension_clients", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 128 }).notNull(),
  tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  createdAt,
});

export const pairingCodes = pgTable("pairing_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  codeHash: varchar("code_hash", { length: 64 }).notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  createdAt,
});

export const developmentDebugPayloads = pgTable(
  "development_debug_payloads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    source: sourceEnum("source").notNull(),
    fieldShape: jsonb("field_shape").notNull(),
    createdAt,
  },
);
