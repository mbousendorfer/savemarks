import { createHash } from "node:crypto";

const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "igsh",
  "igshid",
  "s",
  "t",
]);

export function normalizeUrl(value: string): string {
  const url = new URL(value);
  url.hash = "";
  url.hostname = url.hostname.toLowerCase();
  url.pathname = url.pathname.replace(/\/+$/, "") || "/";

  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_PARAMS.has(key.toLowerCase())) {
      url.searchParams.delete(key);
    }
  }
  url.searchParams.sort();
  return url.toString();
}

export function normalizedUrlHash(value: string): string {
  return createHash("sha256").update(normalizeUrl(value)).digest("hex");
}

export function bookmarkIdentity(source: string, sourceItemId: string): string {
  return `${source}:${sourceItemId}`;
}
