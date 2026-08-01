import {
  bookmarks,
  database,
  mediaAssets,
  resolveMediaPath,
  sha256,
} from "@savemarks/database";
import { and, asc, eq, inArray } from "drizzle-orm";
import { createHash } from "node:crypto";
import { mkdir, open, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, normalize } from "node:path";
import { fetchPublicResource } from "./public-fetch";

const MIME_EXTENSIONS: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/avif": ".avif",
  "video/mp4": ".mp4",
  "video/webm": ".webm",
};

const MAX_IMAGE_BYTES = 30 * 1024 * 1024;
const MAX_VIDEO_BYTES = 750 * 1024 * 1024;

interface PendingMedia {
  id: string;
  source: "x" | "instagram" | "web";
  sourceUrl: string;
  mimeType: string | null;
}

let activeMediaSync: Promise<MediaSyncResult> | undefined;

export interface MediaSyncResult {
  stored: number;
  failed: number;
}

export function mediaRoot(): string {
  const configured = process.env.MEDIA_DATA_PATH;
  if (!configured) return "/data/media";
  if (isAbsolute(configured)) return normalize(configured);
  return normalize(`${process.cwd()}/../../${configured}`);
}

function allowedHost(
  source: PendingMedia["source"],
  hostname: string,
): boolean {
  const host = hostname.toLowerCase();
  if (source === "x") {
    return host === "pbs.twimg.com" || host === "video.twimg.com";
  }
  if (source === "web") return false;
  return (
    host.endsWith(".cdninstagram.com") ||
    host === "cdninstagram.com" ||
    host.endsWith(".fbcdn.net") ||
    host === "fbcdn.net"
  );
}

async function safeFetch(
  source: PendingMedia["source"],
  sourceUrl: string,
): Promise<Response> {
  let url = new URL(sourceUrl);
  for (let redirects = 0; redirects <= 5; redirects += 1) {
    if (url.protocol !== "https:" || !allowedHost(source, url.hostname)) {
      throw new Error(`Media host is not allowed: ${url.hostname}`);
    }
    const response = await fetch(url, {
      redirect: "manual",
      headers: { "user-agent": "SaveMarks/1.0 local media archiver" },
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error("Media redirect has no location");
      url = new URL(location, url);
      continue;
    }
    return response;
  }
  throw new Error("Too many media redirects");
}

export async function streamToFile(
  response: Response,
  destination: string,
  maxBytes: number,
): Promise<{ hash: string; size: number }> {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new Error(
      `Media exceeds the ${Math.round(maxBytes / 1024 / 1024)} MB limit`,
    );
  }
  if (!response.body) throw new Error("Media response has no body");

  const reader = response.body.getReader();
  const file = await open(destination, "w", 0o600);
  const digest = createHash("sha256");
  let size = 0;
  let failed = false;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new Error(
          `Media exceeds the ${Math.round(maxBytes / 1024 / 1024)} MB limit`,
        );
      }
      digest.update(value);
      let offset = 0;
      while (offset < value.byteLength) {
        const { bytesWritten } = await file.write(
          value,
          offset,
          value.byteLength - offset,
        );
        if (bytesWritten === 0) throw new Error("Media file write stalled");
        offset += bytesWritten;
      }
    }
    return { hash: digest.digest("hex"), size };
  } catch (error) {
    failed = true;
    throw error;
  } finally {
    await file.close();
    if (failed) await unlink(destination).catch(() => undefined);
  }
}

async function storeMedia(item: PendingMedia): Promise<void> {
  const db = database();
  await db
    .update(mediaAssets)
    .set({ status: "downloading", failureReason: null, updatedAt: new Date() })
    .where(eq(mediaAssets.id, item.id));

  try {
    let responseMimeType: string;
    let bytes: Uint8Array | undefined;
    let response: Response | undefined;
    if (item.source === "web") {
      const fetched = await fetchPublicResource(item.sourceUrl, {
        maxBytes: 10 * 1024 * 1024,
        timeoutMs: 8_000,
        acceptedTypes: [
          "image/jpeg",
          "image/png",
          "image/webp",
          "image/gif",
          "image/avif",
        ],
      });
      bytes = fetched.bytes;
      responseMimeType = fetched.contentType;
    } else {
      response = await safeFetch(item.source, item.sourceUrl);
      if (!response.ok || !response.body) {
        throw new Error(`Media server returned HTTP ${response.status}`);
      }
      responseMimeType =
        response.headers.get("content-type") ?? item.mimeType ?? "";
    }
    const mimeType = responseMimeType.split(";")[0]?.trim().toLowerCase();
    if (!mimeType || !MIME_EXTENSIONS[mimeType]) {
      throw new Error(`Unsupported media type: ${mimeType || "unknown"}`);
    }
    const maxBytes = mimeType.startsWith("video/")
      ? MAX_VIDEO_BYTES
      : MAX_IMAGE_BYTES;
    if (bytes && bytes.byteLength > maxBytes) {
      throw new Error(
        `Media exceeds the ${Math.round(maxBytes / 1024 / 1024)} MB limit`,
      );
    }

    const kind = mimeType.startsWith("video/") ? "videos" : "pictures";
    const temporary = resolveMediaPath(
      mediaRoot(),
      `.tmp/${item.id}${MIME_EXTENSIONS[mimeType]}`,
    );
    await mkdir(dirname(temporary), { recursive: true });
    const stored = bytes
      ? { hash: sha256(bytes), size: bytes.byteLength }
      : await streamToFile(response!, temporary, maxBytes);
    const relativePath = `${item.source}/media/${kind}/${stored.hash}${MIME_EXTENSIONS[mimeType]}`;
    const destination = resolveMediaPath(mediaRoot(), relativePath);
    await mkdir(dirname(destination), { recursive: true });
    if (bytes) await writeFile(temporary, bytes, { mode: 0o600 });
    await rename(temporary, destination).catch(async (error: unknown) => {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      await unlink(temporary).catch(() => undefined);
    });

    const [existing] = await db
      .select({ id: mediaAssets.id })
      .from(mediaAssets)
      .where(
        and(
          eq(mediaAssets.sha256, stored.hash),
          inArray(mediaAssets.status, ["stored"]),
        ),
      )
      .limit(1);
    await db
      .update(mediaAssets)
      .set({
        sha256: existing?.id === item.id || !existing ? stored.hash : null,
        mimeType,
        fileSize: stored.size,
        localRelativePath: relativePath,
        status: "stored",
        failureReason: null,
        updatedAt: new Date(),
      })
      .where(eq(mediaAssets.id, item.id));
  } catch (error) {
    await db
      .update(mediaAssets)
      .set({
        status: "failed",
        failureReason:
          error instanceof Error
            ? error.message.slice(0, 1_000)
            : "Download failed",
        updatedAt: new Date(),
      })
      .where(eq(mediaAssets.id, item.id));
    throw error;
  }
}

async function performMediaSync(limit: number): Promise<MediaSyncResult> {
  const pending = await database()
    .select({
      id: mediaAssets.id,
      source: bookmarks.source,
      sourceUrl: mediaAssets.sourceUrl,
      mimeType: mediaAssets.mimeType,
    })
    .from(mediaAssets)
    .innerJoin(bookmarks, eq(mediaAssets.bookmarkId, bookmarks.id))
    .where(eq(mediaAssets.status, "pending"))
    .orderBy(asc(mediaAssets.createdAt))
    .limit(limit);

  let stored = 0;
  let failed = 0;
  for (const item of pending) {
    try {
      await storeMedia(item);
      stored += 1;
    } catch {
      failed += 1;
    }
  }
  return { stored, failed };
}

export function startMediaSync(limit = 250): Promise<MediaSyncResult> {
  if (!activeMediaSync) {
    activeMediaSync = performMediaSync(limit).finally(() => {
      activeMediaSync = undefined;
    });
  }
  return activeMediaSync;
}
