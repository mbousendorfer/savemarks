import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import ipaddr from "ipaddr.js";
import { Agent, fetch as undiciFetch } from "undici";

const MAX_REDIRECTS = 5;

interface PublicFetchOptions {
  maxBytes: number;
  timeoutMs: number;
  acceptedTypes: readonly string[];
}

export interface PublicFetchResult {
  bytes: Uint8Array;
  contentType: string;
  finalUrl: string;
}

interface ResolvedAddress {
  address: string;
  family: number;
}

export function pinnedLookupResult(
  pinned: ResolvedAddress,
  all: boolean,
): ResolvedAddress | ResolvedAddress[] {
  return all ? [pinned] : pinned;
}

export function isPublicAddress(address: string): boolean {
  try {
    let parsed = ipaddr.parse(address);
    if (parsed.kind() === "ipv6") {
      const ipv6 = parsed as ipaddr.IPv6;
      if (ipv6.isIPv4MappedAddress()) parsed = ipv6.toIPv4Address();
    }
    return parsed.range() === "unicast";
  } catch {
    return false;
  }
}

async function resolvePublic(hostname: string) {
  if (isIP(hostname)) {
    if (!isPublicAddress(hostname)) throw new Error("Private address blocked");
    return [{ address: hostname, family: isIP(hostname) as 4 | 6 }];
  }
  const addresses = await lookup(hostname, { all: true, verbatim: true });
  if (
    addresses.length === 0 ||
    addresses.some(({ address }) => !isPublicAddress(address))
  ) {
    throw new Error("Private or unresolved host blocked");
  }
  return addresses;
}

function validateUrl(value: string): URL {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Only HTTP(S) URLs are supported");
  }
  if (url.username || url.password)
    throw new Error("URL credentials are blocked");
  return url;
}

async function readLimited(response: Response, maxBytes: number) {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new Error("Remote response is too large");
  }
  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > maxBytes) {
      await reader.cancel();
      throw new Error("Remote response is too large");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export async function fetchPublicResource(
  initialUrl: string,
  options: PublicFetchOptions,
): Promise<PublicFetchResult> {
  let url = validateUrl(initialUrl);
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    const addresses = await resolvePublic(url.hostname);
    const pinned = addresses[0]!;
    const dispatcher = new Agent({
      connect: {
        lookup(_hostname, lookupOptions, callback) {
          if (
            typeof lookupOptions === "object" &&
            "all" in lookupOptions &&
            lookupOptions.all
          ) {
            callback(
              null,
              pinnedLookupResult(pinned, true) as ResolvedAddress[],
            );
          } else {
            const resolved = pinnedLookupResult(
              pinned,
              false,
            ) as ResolvedAddress;
            callback(null, resolved.address, resolved.family);
          }
        },
      },
    });
    try {
      const response = await undiciFetch(url, {
        dispatcher,
        redirect: "manual",
        signal: AbortSignal.timeout(options.timeoutMs),
        headers: {
          accept: options.acceptedTypes.join(", "),
          "user-agent": "SaveMarks/1.0 local read-later service",
        },
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) throw new Error("Redirect has no location");
        url = validateUrl(new URL(location, url).toString());
        continue;
      }
      if (!response.ok)
        throw new Error(`Remote server returned HTTP ${response.status}`);
      const contentType = (response.headers.get("content-type") ?? "")
        .split(";")[0]!
        .trim()
        .toLowerCase();
      if (!options.acceptedTypes.some((type) => contentType === type)) {
        throw new Error(
          `Unsupported remote content type: ${contentType || "unknown"}`,
        );
      }
      return {
        bytes: await readLimited(
          response as unknown as Response,
          options.maxBytes,
        ),
        contentType,
        finalUrl: url.toString(),
      };
    } finally {
      await dispatcher.close();
    }
  }
  throw new Error("Too many redirects");
}
