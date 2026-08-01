import {
  bookmarkTags,
  bookmarks,
  database,
  tags,
  webPages,
} from "@savemarks/database";
import {
  normalizedUrlHash,
  normalizeUrl,
  type ReadLaterCapture,
} from "@savemarks/shared";
import { and, eq, inArray } from "drizzle-orm";

export interface ReadLaterIngestResult {
  id: string;
  created: boolean;
}

function statusValues(status: ReadLaterCapture["status"] | undefined) {
  if (status === "read") return { archived: false, readAt: new Date() };
  if (status === "archived") return { archived: true, readAt: null };
  return { archived: false, readAt: null };
}

export async function ingestReadLater(
  item: ReadLaterCapture,
  mode: "save" | "import",
): Promise<ReadLaterIngestResult> {
  const db = database();
  const canonicalUrl = normalizeUrl(item.url);
  const identity = normalizedUrlHash(canonicalUrl);
  const now = new Date();

  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({
        id: bookmarks.id,
        archived: bookmarks.archived,
        readAt: bookmarks.readAt,
        savedAt: bookmarks.savedAt,
      })
      .from(bookmarks)
      .where(
        and(
          eq(bookmarks.source, "web"),
          eq(bookmarks.normalizedUrlHash, identity),
        ),
      )
      .limit(1);

    let bookmarkId: string;
    if (existing) {
      const explicitStatus = item.status
        ? statusValues(item.status)
        : undefined;
      await tx
        .update(bookmarks)
        .set({
          canonicalUrl,
          sourceItemId: identity,
          ...(mode === "save"
            ? { archived: false, readAt: null, savedAt: now }
            : {
                ...(explicitStatus ?? {}),
                ...(item.savedAt ? { savedAt: new Date(item.savedAt) } : {}),
              }),
          updatedAt: now,
        })
        .where(eq(bookmarks.id, existing.id));
      bookmarkId = existing.id;
    } else {
      const state = statusValues(item.status);
      const [created] = await tx
        .insert(bookmarks)
        .values({
          source: "web",
          sourceItemId: identity,
          canonicalUrl,
          normalizedUrlHash: identity,
          contentType: "link",
          authorId: null,
          savedAt: item.savedAt ? new Date(item.savedAt) : now,
          importedAt: now,
          rawSchemaVersion: "read-later-v1",
          ...state,
        })
        .returning({ id: bookmarks.id });
      if (!created) throw new Error("Could not create read-later item");
      bookmarkId = created.id;
    }

    const metadata = item.metadata;
    await tx
      .insert(webPages)
      .values({
        bookmarkId,
        title: metadata?.title,
        description: metadata?.description,
        siteName: metadata?.siteName,
        author: metadata?.author,
        imageUrl: metadata?.imageUrl,
        enrichmentStatus: "pending",
        nextRetryAt: now,
      })
      .onConflictDoUpdate({
        target: webPages.bookmarkId,
        set: {
          ...(metadata?.title ? { title: metadata.title } : {}),
          ...(metadata?.description
            ? { description: metadata.description }
            : {}),
          ...(metadata?.siteName ? { siteName: metadata.siteName } : {}),
          ...(metadata?.author ? { author: metadata.author } : {}),
          ...(metadata?.imageUrl ? { imageUrl: metadata.imageUrl } : {}),
          enrichmentStatus: "pending",
          nextRetryAt: now,
          lastError: null,
          updatedAt: now,
        },
      });

    if (item.tags.length > 0) {
      await tx
        .insert(tags)
        .values(item.tags.map((name) => ({ name })))
        .onConflictDoNothing({ target: tags.name });
      const resolved = await tx
        .select({ id: tags.id })
        .from(tags)
        .where(inArray(tags.name, item.tags));
      if (resolved.length > 0) {
        await tx
          .insert(bookmarkTags)
          .values(
            resolved.map((tag) => ({ bookmarkId, tagId: tag.id })),
          )
          .onConflictDoNothing();
      }
    }

    return { id: bookmarkId, created: !existing };
  });
}
