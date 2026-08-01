import {
  bookmarkTags,
  bookmarks,
  database,
  mediaAssets,
  tags,
  webPages,
} from "@savemarks/database";
import { readLaterIngestSchema } from "@savemarks/shared";
import { and, asc, count, desc, eq, gt, ilike, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { authenticate } from "../../../lib/auth";
import { corsHeaders, originAllowed } from "../../../lib/cors";
import { rateLimit, readJson } from "../../../lib/http";
import { startReadLaterEnrichment } from "../../../lib/read-later-enrichment";
import { ingestReadLater } from "../../../lib/read-later";

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

async function authorizeWrite(request: Request) {
  if (request.headers.get("authorization")?.startsWith("Bearer ")) {
    return originAllowed(request) && (await authenticate(request));
  }
  return sameOrigin(request);
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: originAllowed(request) ? 204 : 403,
    headers: corsHeaders(request),
  });
}

export async function POST(request: Request) {
  const headers = corsHeaders(request);
  if (!(await authorizeWrite(request))) {
    return Response.json({ error: "Not authorized" }, { status: 401, headers });
  }
  const limited = rateLimit(request, "read-later", 120, 60_000);
  if (limited) return limited;
  const json = await readJson(request, 64_000);
  if (!json.ok) return json.response;
  const parsed = readLaterIngestSchema.safeParse(json.value);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid read-later payload", issues: parsed.error.issues },
      { status: 400, headers },
    );
  }
  const result = await ingestReadLater(parsed.data.item, parsed.data.mode);
  void startReadLaterEnrichment(20);
  return Response.json(result, {
    status: result.created ? 201 : 200,
    headers,
  });
}

export async function GET(request: Request) {
  if (!sameOrigin(request)) {
    return Response.json({ error: "Origin not allowed" }, { status: 403 });
  }
  void startReadLaterEnrichment(20);
  const url = new URL(request.url);
  const status = url.searchParams.get("status") ?? "unread";
  const sort = url.searchParams.get("sort") === "oldest" ? "oldest" : "newest";
  const query = url.searchParams.get("q")?.trim().slice(0, 200);
  const tag = url.searchParams.get("tag")?.trim().slice(0, 50);
  const cursor = url.searchParams.get("cursor");
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 30));
  let cursorDate: Date | undefined;
  let cursorId: string | undefined;
  if (cursor) {
    try {
      const [date, id] = Buffer.from(cursor, "base64url").toString().split("|");
      if (date && id && !Number.isNaN(new Date(date).getTime())) {
        cursorDate = new Date(date);
        cursorId = id;
      }
    } catch {
      // Invalid cursors are treated as the first page.
    }
  }

  const conditions = [eq(bookmarks.source, "web")];
  if (status === "unread") {
    conditions.push(sql`${bookmarks.readAt} is null`, eq(bookmarks.archived, false));
  } else if (status === "read") {
    conditions.push(sql`${bookmarks.readAt} is not null`, eq(bookmarks.archived, false));
  } else if (status === "archived") {
    conditions.push(eq(bookmarks.archived, true));
  } else {
    conditions.push(eq(bookmarks.archived, false));
  }
  if (query) {
    const pattern = `%${query.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
    conditions.push(
      or(
        ilike(webPages.title, pattern),
        ilike(webPages.description, pattern),
        ilike(webPages.siteName, pattern),
        ilike(bookmarks.canonicalUrl, pattern),
      )!,
    );
  }
  if (cursorDate && cursorId) {
    conditions.push(
      (sort === "oldest"
        ? or(
            gt(bookmarks.savedAt, cursorDate),
            and(eq(bookmarks.savedAt, cursorDate), gt(bookmarks.id, cursorId)),
          )
        : or(
            lt(bookmarks.savedAt, cursorDate),
            and(eq(bookmarks.savedAt, cursorDate), lt(bookmarks.id, cursorId)),
          ))!,
    );
  }
  if (tag) {
    conditions.push(sql`exists (
      select 1 from ${bookmarkTags} bt
      inner join ${tags} t on t.id = bt.tag_id
      where bt.bookmark_id = ${bookmarks.id} and t.name = ${tag.toLocaleLowerCase()}
    )`);
  }

  const rows = await database()
    .select({
      id: bookmarks.id,
      canonicalUrl: bookmarks.canonicalUrl,
      savedAt: bookmarks.savedAt,
      readAt: bookmarks.readAt,
      archived: bookmarks.archived,
      title: webPages.title,
      description: webPages.description,
      siteName: webPages.siteName,
      author: webPages.author,
      enrichmentStatus: webPages.enrichmentStatus,
      lastError: webPages.lastError,
    })
    .from(bookmarks)
    .innerJoin(webPages, eq(webPages.bookmarkId, bookmarks.id))
    .where(and(...conditions))
    .orderBy(
      sort === "oldest" ? asc(bookmarks.savedAt) : desc(bookmarks.savedAt),
      sort === "oldest" ? asc(bookmarks.id) : desc(bookmarks.id),
    )
    .limit(limit + 1);
  const page = rows.slice(0, limit);
  const ids = page.map((item) => item.id);
  const [tagRows, mediaRows] = ids.length
    ? await Promise.all([
        database()
          .select({ bookmarkId: bookmarkTags.bookmarkId, name: tags.name })
          .from(bookmarkTags)
          .innerJoin(tags, eq(bookmarkTags.tagId, tags.id))
          .where(inArray(bookmarkTags.bookmarkId, ids)),
        database()
          .select({ bookmarkId: mediaAssets.bookmarkId, id: mediaAssets.id })
          .from(mediaAssets)
          .where(
            and(
              inArray(mediaAssets.bookmarkId, ids),
              eq(mediaAssets.status, "stored"),
            ),
          )
          .orderBy(asc(mediaAssets.position)),
      ])
    : [[], []];
  const tagsById = new Map<string, string[]>();
  for (const row of tagRows) {
    tagsById.set(row.bookmarkId, [...(tagsById.get(row.bookmarkId) ?? []), row.name]);
  }
  const mediaById = new Map<string, string>();
  for (const row of mediaRows) {
    if (!mediaById.has(row.bookmarkId)) mediaById.set(row.bookmarkId, row.id);
  }
  const last = page.at(-1);
  const [unread] = await database()
    .select({ value: count() })
    .from(bookmarks)
    .where(
      and(
        eq(bookmarks.source, "web"),
        eq(bookmarks.archived, false),
        isNull(bookmarks.readAt),
      ),
    );
  return Response.json({
    items: page.map((item) => ({
      ...item,
      savedAt: item.savedAt?.toISOString() ?? new Date(0).toISOString(),
      readAt: item.readAt?.toISOString() ?? null,
      tags: tagsById.get(item.id)?.sort() ?? [],
      imageUrl: mediaById.has(item.id) ? `/api/media/${mediaById.get(item.id)}` : null,
    })),
    nextCursor:
      rows.length > limit && last?.savedAt
        ? Buffer.from(`${last.savedAt.toISOString()}|${last.id}`).toString("base64url")
        : null,
    unreadCount: unread?.value ?? 0,
  });
}
