import {
  bookmarkTags,
  bookmarks,
  database,
  mediaAssets,
  resolveMediaPath,
  tags,
} from "@savemarks/database";
import { inArray } from "drizzle-orm";
import { unlink } from "node:fs/promises";
import { mediaRoot } from "./media-download";

export async function archiveBookmarks(
  ids: string[],
  archived: boolean,
): Promise<string[]> {
  if (ids.length === 0) return [];
  const rows = await database()
    .update(bookmarks)
    .set({ archived, updatedAt: new Date() })
    .where(inArray(bookmarks.id, ids))
    .returning({ id: bookmarks.id });
  return rows.map((row) => row.id);
}

export async function addTagToBookmarks(
  ids: string[],
  name: string,
): Promise<string[]> {
  if (ids.length === 0) return [];
  return database().transaction(async (tx) => {
    const existing = await tx
      .select({ id: bookmarks.id })
      .from(bookmarks)
      .where(inArray(bookmarks.id, ids));
    if (existing.length === 0) return [];

    await tx.insert(tags).values({ name }).onConflictDoNothing({ target: tags.name });
    const [tag] = await tx
      .select({ id: tags.id })
      .from(tags)
      .where(inArray(tags.name, [name]))
      .limit(1);
    if (!tag) return [];

    await tx
      .insert(bookmarkTags)
      .values(existing.map((bookmark) => ({ bookmarkId: bookmark.id, tagId: tag.id })))
      .onConflictDoNothing();
    return existing.map((bookmark) => bookmark.id);
  });
}

export async function deleteBookmarks(ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const db = database();
  const assets = await db
    .select({ localRelativePath: mediaAssets.localRelativePath })
    .from(mediaAssets)
    .where(inArray(mediaAssets.bookmarkId, ids));
  const paths = [
    ...new Set(
      assets
        .map((asset) => asset.localRelativePath)
        .filter((path): path is string => Boolean(path)),
    ),
  ];

  const deleted = await db
    .delete(bookmarks)
    .where(inArray(bookmarks.id, ids))
    .returning({ id: bookmarks.id });

  if (paths.length > 0) {
    const stillReferenced = await db
      .select({ localRelativePath: mediaAssets.localRelativePath })
      .from(mediaAssets)
      .where(inArray(mediaAssets.localRelativePath, paths));
    const retained = new Set(
      stillReferenced
        .map((asset) => asset.localRelativePath)
        .filter((path): path is string => Boolean(path)),
    );
    await Promise.all(
      paths
        .filter((path) => !retained.has(path))
        .map((path) =>
          unlink(resolveMediaPath(mediaRoot(), path)).catch(() => undefined),
        ),
    );
  }

  return deleted.map((row) => row.id);
}
