import {
  authors,
  bookmarks,
  bookmarkTags,
  database,
  mediaAssets,
  tags,
} from "@savemarks/database";
import { and, asc, count, desc, eq, isNull, sql } from "drizzle-orm";
import { Library, type LibraryBookmark } from "./library";

export const dynamic = "force-dynamic";

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string }>;
}) {
  const { source } = await searchParams;
  const initialSource =
    source === "x" || source === "instagram" ? source : undefined;
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
      mediaStatus: mediaAssets.status,
      mediaLocalRelativePath: mediaAssets.localRelativePath,
    })
    .from(bookmarks)
    .innerJoin(authors, eq(bookmarks.authorId, authors.id))
    .leftJoin(mediaAssets, eq(mediaAssets.bookmarkId, bookmarks.id))
    .orderBy(
      sql`${bookmarks.savedAt} is null`,
      desc(bookmarks.savedAt),
      asc(bookmarks.createdAt),
    );

  const tagRows = await database()
    .select({
      bookmarkId: bookmarkTags.bookmarkId,
      name: tags.name,
    })
    .from(bookmarkTags)
    .innerJoin(tags, eq(bookmarkTags.tagId, tags.id));
  const [readLater] = await database()
    .select({ value: count() })
    .from(bookmarks)
    .where(
      and(
        eq(bookmarks.source, "web"),
        eq(bookmarks.archived, false),
        isNull(bookmarks.readAt),
      ),
    );
  const tagsByBookmark = new Map<string, string[]>();
  for (const row of tagRows) {
    const existing = tagsByBookmark.get(row.bookmarkId) ?? [];
    existing.push(row.name);
    tagsByBookmark.set(row.bookmarkId, existing);
  }

  const byId = new Map<string, LibraryBookmark>();
  for (const row of rows) {
    if (row.source === "web" || row.contentType === "link") continue;
    const existing = byId.get(row.id);
    if (existing) {
      if (row.mediaId && row.mediaUrl) {
        existing.media.push({
          id: row.mediaId,
          url:
            row.mediaStatus === "stored" && row.mediaLocalRelativePath
              ? `/api/media/${row.mediaId}`
              : row.mediaUrl,
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
      tags: tagsByBookmark.get(row.id)?.sort() ?? [],
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
                url:
                  row.mediaStatus === "stored" && row.mediaLocalRelativePath
                    ? `/api/media/${row.mediaId}`
                    : row.mediaUrl,
                mimeType: row.mediaType,
                width: row.mediaWidth,
                height: row.mediaHeight,
                position: row.mediaPosition ?? 0,
              },
            ]
          : [],
    });
  }

  return (
    <Library
      initialBookmarks={[...byId.values()]}
      initialReadLaterCount={readLater?.value ?? 0}
      initialSource={initialSource}
    />
  );
}
