import {
  authors,
  bookmarks,
  database,
  mediaAssets,
} from "@savemarks/database";
import { bookmarkIngestSchema, normalizedUrlHash } from "@savemarks/shared";
import { corsHeaders, originAllowed } from "../../../lib/cors";
import { authenticate } from "../../../lib/auth";

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: originAllowed(request) ? 204 : 403,
    headers: corsHeaders(request),
  });
}

export async function POST(request: Request) {
  const headers = corsHeaders(request);
  if (!originAllowed(request)) {
    return Response.json({ error: "Origin not allowed" }, { status: 403, headers });
  }
  if (!(await authenticate(request))) {
    return Response.json({ error: "Pairing required" }, { status: 401, headers });
  }

  const parsed = bookmarkIngestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: "Invalid bookmark payload" }, { status: 400, headers });
  }
  const item = parsed.data.bookmark;
  const result = await database().transaction(async (tx) => {
    const [author] = await tx
      .insert(authors)
      .values({
        source: item.source,
        sourceId: item.author.sourceId,
        username: item.author.username,
        displayName: item.author.displayName,
        profileUrl: item.author.profileUrl,
        avatarUrl: item.author.avatarUrl,
      })
      .onConflictDoUpdate({
        target: [authors.source, authors.username],
        set: {
          sourceId: item.author.sourceId,
          displayName: item.author.displayName,
          profileUrl: item.author.profileUrl,
          avatarUrl: item.author.avatarUrl,
          updatedAt: new Date(),
        },
      })
      .returning({ id: authors.id });
    if (!author) throw new Error("Could not resolve author");

    const [bookmark] = await tx
      .insert(bookmarks)
      .values({
        source: item.source,
        sourceItemId: item.sourceItemId,
        canonicalUrl: item.canonicalUrl,
        normalizedUrlHash: normalizedUrlHash(item.canonicalUrl),
        contentType: item.contentType,
        text: item.text,
        caption: item.caption,
        authorId: author.id,
        publishedAt: item.publishedAt ? new Date(item.publishedAt) : null,
        savedAt: item.savedAt ? new Date(item.savedAt) : null,
        importedAt: new Date(item.importedAt),
        rawSchemaVersion: item.rawSchemaVersion,
      })
      .onConflictDoNothing({
        target: [bookmarks.source, bookmarks.sourceItemId],
      })
      .returning({ id: bookmarks.id });

    if (!bookmark) return { duplicate: true };
    if (item.media.length > 0) {
      await tx.insert(mediaAssets).values(
        item.media.map((media) => ({
          bookmarkId: bookmark.id,
          sourceUrl: media.sourceUrl,
          mimeType: media.mimeType,
          width: media.width,
          height: media.height,
          durationSeconds: media.durationSeconds
            ? Math.round(media.durationSeconds)
            : undefined,
          position: media.position,
        })),
      );
    }
    return { duplicate: false, id: bookmark.id };
  });
  return Response.json(result, { status: result.duplicate ? 200 : 201, headers });
}
