import {
  bookmarks,
  database,
  mediaAssets,
  webPages,
} from "@savemarks/database";
import { and, asc, eq, lt, lte, or } from "drizzle-orm";
import { load } from "cheerio";
import { fetchPublicResource } from "./public-fetch";
import { startMediaSync } from "./media-download";

const MAX_HTML_BYTES = 2 * 1024 * 1024;
const MAX_ATTEMPTS = 5;
let activeEnrichment: Promise<number> | undefined;

function clean(value: string | undefined, max: number) {
  const normalized = value?.replace(/\s+/g, " ").trim();
  return normalized ? normalized.slice(0, max) : undefined;
}

function absoluteUrl(value: string | undefined, base: string) {
  if (!value) return undefined;
  try {
    const url = new URL(value, base);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

export function extractPageMetadata(html: string, finalUrl: string) {
  const $ = load(html);
  const meta = (key: string) =>
    clean(
      $(`meta[property="${key}"], meta[name="${key}"]`).first().attr("content"),
      10_000,
    );
  return {
    title: clean(meta("og:title") ?? meta("twitter:title") ?? $("title").first().text(), 2_000),
    description: clean(
      meta("og:description") ?? meta("twitter:description") ?? meta("description"),
      10_000,
    ),
    siteName: clean(meta("og:site_name"), 512) ?? new URL(finalUrl).hostname,
    author: clean(meta("author") ?? $("[rel=author]").first().text(), 512),
    imageUrl: absoluteUrl(meta("og:image") ?? meta("twitter:image"), finalUrl),
  };
}

async function enrichOne(item: {
  bookmarkId: string;
  canonicalUrl: string;
  attempts: number;
  title: string | null;
  description: string | null;
  siteName: string | null;
  author: string | null;
  imageUrl: string | null;
}) {
  const db = database();
  const attempts = item.attempts + 1;
  await db
    .update(webPages)
    .set({
      enrichmentStatus: "processing",
      enrichmentAttempts: attempts,
      updatedAt: new Date(),
    })
    .where(eq(webPages.bookmarkId, item.bookmarkId));
  try {
    const response = await fetchPublicResource(item.canonicalUrl, {
      maxBytes: MAX_HTML_BYTES,
      timeoutMs: 8_000,
      acceptedTypes: ["text/html", "application/xhtml+xml"],
    });
    const extracted = extractPageMetadata(
      new TextDecoder().decode(response.bytes),
      response.finalUrl,
    );
    const imageUrl = item.imageUrl ?? extracted.imageUrl ?? null;
    await db.transaction(async (tx) => {
      await tx
        .update(webPages)
        .set({
          title: item.title ?? extracted.title ?? new URL(response.finalUrl).hostname,
          description: item.description ?? extracted.description ?? null,
          siteName: item.siteName ?? extracted.siteName,
          author: item.author ?? extracted.author ?? null,
          imageUrl,
          enrichmentStatus: "complete",
          lastError: null,
          enrichedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(webPages.bookmarkId, item.bookmarkId));
      if (imageUrl) {
        const [existingMedia] = await tx
          .select({ id: mediaAssets.id })
          .from(mediaAssets)
          .where(
            and(
              eq(mediaAssets.bookmarkId, item.bookmarkId),
              eq(mediaAssets.sourceUrl, imageUrl),
            ),
          )
          .limit(1);
        if (!existingMedia) {
          await tx.insert(mediaAssets).values({
              bookmarkId: item.bookmarkId,
              sourceUrl: imageUrl,
              position: 0,
            });
        }
      }
    });
    if (imageUrl) void startMediaSync(25);
  } catch (error) {
    const delayMinutes = Math.min(360, 2 ** attempts);
    await db
      .update(webPages)
      .set({
        enrichmentStatus: "failed",
        lastError: error instanceof Error ? error.message.slice(0, 1_000) : "Enrichment failed",
        nextRetryAt: new Date(Date.now() + delayMinutes * 60_000),
        updatedAt: new Date(),
      })
      .where(eq(webPages.bookmarkId, item.bookmarkId));
  }
}

async function performEnrichment(limit: number) {
  const stale = new Date(Date.now() - 10 * 60_000);
  const rows = await database()
    .select({
      bookmarkId: webPages.bookmarkId,
      canonicalUrl: bookmarks.canonicalUrl,
      attempts: webPages.enrichmentAttempts,
      title: webPages.title,
      description: webPages.description,
      siteName: webPages.siteName,
      author: webPages.author,
      imageUrl: webPages.imageUrl,
    })
    .from(webPages)
    .innerJoin(bookmarks, eq(webPages.bookmarkId, bookmarks.id))
    .where(
      and(
        lt(webPages.enrichmentAttempts, MAX_ATTEMPTS),
        or(
          and(
            or(
              eq(webPages.enrichmentStatus, "pending"),
              eq(webPages.enrichmentStatus, "failed"),
            ),
            lte(webPages.nextRetryAt, new Date()),
          ),
          and(
            eq(webPages.enrichmentStatus, "processing"),
            lte(webPages.updatedAt, stale),
          ),
        ),
      ),
    )
    .orderBy(asc(webPages.nextRetryAt))
    .limit(limit);
  for (const row of rows) await enrichOne(row);
  return rows.length;
}

export function startReadLaterEnrichment(limit = 50) {
  if (!activeEnrichment) {
    const run = performEnrichment(limit);
    activeEnrichment = run.finally(() => {
        activeEnrichment = undefined;
      });
    void run.then((processed) => {
      if (processed === limit) {
        setTimeout(() => void startReadLaterEnrichment(limit), 1_000);
      }
    });
  }
  return activeEnrichment;
}

export async function retryReadLaterEnrichment(bookmarkId: string) {
  await database()
    .update(webPages)
    .set({
      enrichmentStatus: "pending",
      enrichmentAttempts: 0,
      nextRetryAt: new Date(),
      lastError: null,
      updatedAt: new Date(),
    })
    .where(eq(webPages.bookmarkId, bookmarkId));
  void startReadLaterEnrichment(10);
}
