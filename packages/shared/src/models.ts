import { z } from "zod";

export const sourceSchema = z.enum(["x", "instagram"]);
export const contentTypeSchema = z.enum([
  "text",
  "image",
  "video",
  "carousel",
  "reel",
  "thread",
  "quote",
]);

export const normalizedAuthorSchema = z.object({
  sourceId: z.string().min(1).optional(),
  username: z.string().min(1).max(256),
  displayName: z.string().max(512).optional(),
  profileUrl: z.url().optional(),
  avatarUrl: z.url().optional(),
});

export const normalizedMediaCandidateSchema = z.object({
  sourceUrl: z.url(),
  type: z.enum(["image", "video", "thumbnail"]),
  mimeType: z.string().max(256).optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  durationSeconds: z.number().nonnegative().optional(),
  position: z.number().int().nonnegative(),
});

export const normalizedBookmarkSchema = z.object({
  source: sourceSchema,
  sourceItemId: z.string().min(1).max(512),
  canonicalUrl: z.url(),
  contentType: contentTypeSchema,
  text: z.string().max(100_000).optional(),
  caption: z.string().max(100_000).optional(),
  author: normalizedAuthorSchema,
  media: z.array(normalizedMediaCandidateSchema).max(100),
  sourceCollection: z
    .object({
      sourceId: z.string().min(1).optional(),
      name: z.string().min(1).max(512),
    })
    .optional(),
  publishedAt: z.iso.datetime().optional(),
  savedAt: z.iso.datetime().optional(),
  importedAt: z.iso.datetime(),
  rawSchemaVersion: z.string().min(1).max(128),
});

export type Source = z.infer<typeof sourceSchema>;
export type BookmarkContentType = z.infer<typeof contentTypeSchema>;
export type NormalizedAuthor = z.infer<typeof normalizedAuthorSchema>;
export type NormalizedMediaCandidate = z.infer<
  typeof normalizedMediaCandidateSchema
>;
export type NormalizedBookmark = z.infer<typeof normalizedBookmarkSchema>;

export const sourceErrorCodeSchema = z.enum([
  "NOT_AUTHENTICATED",
  "REQUEST_TEMPLATE_MISSING",
  "REQUEST_TEMPLATE_EXPIRED",
  "RATE_LIMITED",
  "SCHEMA_CHANGED",
  "MEDIA_DOWNLOAD_FAILED",
  "SERVER_UNAVAILABLE",
  "PAIRING_REQUIRED",
  "UNKNOWN",
]);

export type SourceErrorCode = z.infer<typeof sourceErrorCodeSchema>;
