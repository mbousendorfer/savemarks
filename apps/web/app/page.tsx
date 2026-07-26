import { authors, bookmarks, database, mediaAssets } from "@savemarks/database";
import { desc, eq } from "drizzle-orm";
import { Library, type LibraryBookmark } from "./library";

export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  const rows = await database()
    .select({
      id: bookmarks.id,
      source: bookmarks.source,
      sourceItemId: bookmarks.sourceItemId,
      canonicalUrl: bookmarks.canonicalUrl,
      contentType: bookmarks.contentType,
      text: bookmarks.text,
      caption: bookmarks.caption,
      publishedAt: bookmarks.publishedAt,
      savedAt: bookmarks.savedAt,
      importedAt: bookmarks.importedAt,
      archived: bookmarks.archived,
      authorUsername: authors.username,
      authorDisplayName: authors.displayName,
      authorAvatarUrl: authors.avatarUrl,
      mediaId: mediaAssets.id,
      mediaUrl: mediaAssets.sourceUrl,
      mediaType: mediaAssets.mimeType,
      mediaWidth: mediaAssets.width,
      mediaHeight: mediaAssets.height,
      mediaPosition: mediaAssets.position,
    })
    .from(bookmarks)
    .innerJoin(authors, eq(bookmarks.authorId, authors.id))
    .leftJoin(mediaAssets, eq(mediaAssets.bookmarkId, bookmarks.id))
    .orderBy(desc(bookmarks.publishedAt), desc(bookmarks.importedAt));

  const byId = new Map<string, LibraryBookmark>();
  for (const row of rows) {
    const existing = byId.get(row.id);
    if (existing) {
      if (row.mediaId && row.mediaUrl) {
        existing.media.push({
          id: row.mediaId,
          url: row.mediaUrl,
          mimeType: row.mediaType,
          width: row.mediaWidth,
          height: row.mediaHeight,
          position: row.mediaPosition ?? 0,
        });
      }
      continue;
    }

    byId.set(row.id, {
      id: row.id,
      source: row.source,
      sourceItemId: row.sourceItemId,
      canonicalUrl: row.canonicalUrl,
      contentType: row.contentType,
      text: row.text,
      caption: row.caption,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      savedAt: row.savedAt?.toISOString() ?? null,
      importedAt: row.importedAt.toISOString(),
      archived: row.archived,
      author: {
        username: row.authorUsername,
        displayName: row.authorDisplayName,
        avatarUrl: row.authorAvatarUrl,
      },
      media:
        row.mediaId && row.mediaUrl
          ? [
              {
                id: row.mediaId,
                url: row.mediaUrl,
                mimeType: row.mediaType,
                width: row.mediaWidth,
                height: row.mediaHeight,
                position: row.mediaPosition ?? 0,
              },
            ]
          : [],
    });
  }

  return <Library initialBookmarks={[...byId.values()]} />;
}
