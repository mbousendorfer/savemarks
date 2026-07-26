import type { NormalizedBookmark } from "@savemarks/shared";
import { ObservedSourceAdapter } from "./base";

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : undefined;
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function string(value: unknown): string | undefined {
  if (typeof value === "string" && value.length > 0) return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

function number(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function nested(root: unknown, ...keys: string[]): unknown {
  let current = root;
  for (const key of keys) current = record(current)?.[key];
  return current;
}

function timestamp(value: unknown): string | undefined {
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string" && /^\d+$/.test(value)
        ? Number(value)
        : undefined;
  if (numeric === undefined) return undefined;
  const parsed = new Date(numeric < 10_000_000_000 ? numeric * 1_000 : numeric);
  return Number.isNaN(parsed.valueOf()) ? undefined : parsed.toISOString();
}

function largestImage(value: unknown): UnknownRecord | undefined {
  return array(value)
    .map(record)
    .filter((candidate): candidate is UnknownRecord => Boolean(candidate))
    .sort(
      (left, right) =>
        (number(right.width) ?? 0) * (number(right.height) ?? 0) -
        (number(left.width) ?? 0) * (number(left.height) ?? 0),
    )[0];
}

function mediaForItem(
  item: UnknownRecord,
  position: number,
): NormalizedBookmark["media"] {
  const media: NormalizedBookmark["media"] = [];
  const image = largestImage(
    nested(item, "image_versions2", "candidates") ??
      nested(item, "image_versions", "candidates"),
  );
  const imageUrl = string(image?.url) ?? string(item.display_url);
  const video = largestImage(item.video_versions);
  const videoUrl = string(video?.url) ?? string(item.video_url);

  if (videoUrl) {
    media.push({
      sourceUrl: videoUrl,
      type: "video",
      mimeType: "video/mp4",
      ...(number(video?.width) ? { width: number(video?.width) } : {}),
      ...(number(video?.height) ? { height: number(video?.height) } : {}),
      ...(number(item.video_duration)
        ? { durationSeconds: number(item.video_duration) }
        : {}),
      position,
    });
  }
  if (imageUrl) {
    media.push({
      sourceUrl: imageUrl,
      type: videoUrl ? "thumbnail" : "image",
      mimeType: "image/jpeg",
      ...(number(image?.width) ? { width: number(image?.width) } : {}),
      ...(number(image?.height) ? { height: number(image?.height) } : {}),
      position,
    });
  }
  return media;
}

function unwrapNode(value: unknown): UnknownRecord | undefined {
  const candidate = record(value);
  return record(candidate?.node) ?? record(candidate?.media) ?? candidate;
}

export function parseInstagramBookmark(
  value: unknown,
  sourceCollection?: NormalizedBookmark["sourceCollection"],
): NormalizedBookmark | null {
  const item = unwrapNode(value);
  if (!item) return null;
  const sourceItemId =
    string(item.pk) ?? string(item.id) ?? string(item.media_id);
  const code =
    string(item.code) ?? string(item.shortcode) ?? string(item.short_code);
  const user =
    record(item.user) ??
    record(item.owner) ??
    record(nested(item, "user", "profile"));
  const username = string(user?.username);
  if (!sourceItemId || !code || !username) return null;

  const carousel = array(
    item.carousel_media ?? nested(item, "edge_sidecar_to_children", "edges"),
  ).map(unwrapNode).filter((child): child is UnknownRecord => Boolean(child));
  const isReel =
    string(item.product_type) === "clips" ||
    string(item.media_type) === "2" && string(item.product_type) === "clips";
  const itemMedia =
    carousel.length > 0
      ? carousel.flatMap((child, index) => mediaForItem(child, index))
      : mediaForItem(item, 0);
  const hasVideo = itemMedia.some((candidate) => candidate.type === "video");
  const contentType = isReel
    ? "reel"
    : carousel.length > 1
      ? "carousel"
      : hasVideo
        ? "video"
        : "image";
  const captionEdges = array(nested(item, "edge_media_to_caption", "edges"));
  const caption =
    string(record(item.caption)?.text) ??
    string(nested(captionEdges[0], "node", "text")) ??
    string(item.caption_text);
  const avatarUrl =
    string(user?.profile_pic_url) ??
    string(user?.profile_pic_url_hd) ??
    string(user?.profile_picture);

  return {
    source: "instagram",
    sourceItemId,
    canonicalUrl: `https://www.instagram.com/${isReel ? "reel" : "p"}/${code}/`,
    contentType,
    ...(caption ? { caption, text: caption } : {}),
    author: {
      sourceId: string(user?.pk) ?? string(user?.id),
      username,
      displayName: string(user?.full_name),
      profileUrl: `https://www.instagram.com/${username}/`,
      ...(avatarUrl ? { avatarUrl } : {}),
    },
    media: itemMedia,
    ...(sourceCollection ? { sourceCollection } : {}),
    publishedAt: timestamp(item.taken_at ?? item.taken_at_timestamp),
    importedAt: new Date().toISOString(),
    rawSchemaVersion: "instagram-saved-2026-07-26",
  };
}

function firstArrayAtKnownPath(value: unknown): unknown[] {
  const candidates = [
    nested(value, "items"),
    nested(value, "data", "items"),
    nested(value, "data", "saved", "items"),
    nested(value, "data", "xdt_api__v1__feed__saved__posts", "items"),
    nested(
      value,
      "data",
      "xdt_api__v1__feed__saved__posts__connection",
      "edges",
    ),
  ];
  return candidates.map(array).find((items) => items.length > 0) ?? [];
}

export function parseInstagramBookmarksPage(
  value: unknown,
  sourceCollection?: NormalizedBookmark["sourceCollection"],
): { items: NormalizedBookmark[]; cursor?: string } {
  const root = record(value);
  const connection = record(
    nested(
      value,
      "data",
      "xdt_api__v1__feed__saved__posts__connection",
    ),
  );
  const pageInfo = record(connection?.page_info);
  const cursor =
    string(root?.next_max_id) ??
    string(nested(value, "data", "next_max_id")) ??
    string(connection?.next_max_id) ??
    string(pageInfo?.end_cursor);
  const items = firstArrayAtKnownPath(value)
    .map((item) => parseInstagramBookmark(item, sourceCollection))
    .filter((item): item is NormalizedBookmark => item !== null);
  return { items, ...(cursor ? { cursor } : {}) };
}

export class InstagramAdapter extends ObservedSourceAdapter {
  readonly source = "instagram" as const;

  protected async parseObservedPage(
    raw: unknown,
  ): Promise<NormalizedBookmark[]> {
    return parseInstagramBookmarksPage(raw).items;
  }
}
