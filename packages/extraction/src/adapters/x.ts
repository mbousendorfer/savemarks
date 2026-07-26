import type { NormalizedBookmark } from "@savemarks/shared";
import { ObservedSourceAdapter } from "./base";

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : undefined;
}

function string(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function number(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function nested(root: unknown, ...keys: string[]): unknown {
  let current = root;
  for (const key of keys) {
    current = record(current)?.[key];
  }
  return current;
}

function date(value: unknown): string | undefined {
  const raw = string(value);
  if (!raw) return undefined;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.valueOf()) ? undefined : parsed.toISOString();
}

function unwrapTweet(value: unknown): UnknownRecord | undefined {
  const result = record(value);
  return record(result?.tweet) ?? result;
}

function mediaCandidates(tweet: UnknownRecord): NormalizedBookmark["media"] {
  const legacy = record(tweet.legacy);
  const media = array(
    nested(legacy, "extended_entities", "media") ??
      nested(legacy, "entities", "media"),
  );
  const candidates: NormalizedBookmark["media"] = [];

  for (const [index, raw] of media.entries()) {
    const item = record(raw);
    if (!item) continue;
    const mediaType = string(item.type);
    const original = record(item.original_info);
    const width = number(original?.width);
    const height = number(original?.height);
    const thumbnail = string(item.media_url_https);

    if (mediaType === "video" || mediaType === "animated_gif") {
      const variants = array(nested(item, "video_info", "variants"))
        .map(record)
        .filter((variant): variant is UnknownRecord => Boolean(variant))
        .filter((variant) => string(variant.content_type) === "video/mp4")
        .sort((left, right) => (number(right.bitrate) ?? 0) - (number(left.bitrate) ?? 0));
      const sourceUrl = string(variants[0]?.url);
      if (sourceUrl) {
        candidates.push({
          sourceUrl,
          type: "video",
          mimeType: "video/mp4",
          ...(width ? { width } : {}),
          ...(height ? { height } : {}),
          position: index,
        });
      }
      if (thumbnail) {
        candidates.push({
          sourceUrl: thumbnail,
          type: "thumbnail",
          ...(width ? { width } : {}),
          ...(height ? { height } : {}),
          position: index,
        });
      }
      continue;
    }

    if (thumbnail) {
      candidates.push({
        sourceUrl: thumbnail,
        type: "image",
        ...(width ? { width } : {}),
        ...(height ? { height } : {}),
        position: index,
      });
    }
  }

  return candidates;
}

export function parseXBookmark(value: unknown): NormalizedBookmark | null {
  const tweet = unwrapTweet(value);
  if (!tweet) return null;
  const sourceItemId = string(tweet.rest_id);
  const legacy = record(tweet.legacy);
  const user = record(nested(tweet, "core", "user_results", "result"));
  const username = string(nested(user, "core", "screen_name"));
  if (!sourceItemId || !legacy || !username) return null;

  const media = mediaCandidates(tweet);
  const quoted = Boolean(record(nested(tweet, "quoted_status_result", "result")));
  const hasVideo = media.some((item) => item.type === "video");
  const imageCount = media.filter((item) => item.type === "image").length;
  const contentType = quoted
    ? "quote"
    : hasVideo
      ? "video"
      : imageCount > 1
        ? "carousel"
        : imageCount === 1
          ? "image"
          : "text";
  const text =
    string(nested(tweet, "note_tweet", "note_tweet_results", "result", "text")) ??
    string(legacy.full_text);
  const avatarUrl =
    string(nested(user, "avatar", "image_url")) ??
    string(nested(user, "legacy", "profile_image_url_https"));

  return {
    source: "x",
    sourceItemId,
    canonicalUrl: `https://x.com/${username}/status/${sourceItemId}`,
    contentType,
    ...(text ? { text } : {}),
    author: {
      sourceId: string(user?.rest_id),
      username,
      displayName: string(nested(user, "core", "name")),
      profileUrl: `https://x.com/${username}`,
      ...(avatarUrl ? { avatarUrl } : {}),
    },
    media,
    publishedAt: date(legacy.created_at),
    importedAt: new Date().toISOString(),
    rawSchemaVersion: "x-bookmarks-2026-07-26",
  };
}

export function parseXBookmarksPage(value: unknown): {
  items: NormalizedBookmark[];
  cursor?: string;
} {
  const instructions = array(
    nested(
      value,
      "data",
      "bookmark_timeline_v2",
      "timeline",
      "instructions",
    ),
  );
  const entries = instructions.flatMap((instruction) =>
    array(record(instruction)?.entries),
  );
  const items: NormalizedBookmark[] = [];
  let cursor: string | undefined;

  for (const entry of entries) {
    const content = record(record(entry)?.content);
    if (!content) continue;
    if (string(content.cursorType)?.toLowerCase() === "bottom") {
      cursor = string(content.value);
    }
    const bookmark = parseXBookmark(
      nested(content, "itemContent", "tweet_results", "result"),
    );
    if (bookmark) items.push(bookmark);
  }

  return { items, ...(cursor ? { cursor } : {}) };
}

export class XAdapter extends ObservedSourceAdapter {
  readonly source = "x" as const;

  protected async parseObservedPage(
    raw: unknown,
  ): Promise<NormalizedBookmark[]> {
    return parseXBookmarksPage(raw).items;
  }
}
