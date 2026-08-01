function httpOrigin(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.origin
      : undefined;
  } catch {
    return undefined;
  }
}

function forwardedOrigin(request: Request): string | undefined {
  const host = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const protocol = request.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim();
  if (!host || (protocol !== "http" && protocol !== "https")) return undefined;
  return httpOrigin(`${protocol}://${host}`);
}

/**
 * Protect browser writes from cross-site requests while still supporting the
 * HTTPS reverse proxies commonly used in front of the standalone container.
 */
export function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  const allowed = new Set<string>();
  const requestOrigin = httpOrigin(request.url);
  const configuredOrigin = httpOrigin(process.env.SAVEMARKS_BASE_URL);
  const proxyOrigin = forwardedOrigin(request);
  if (requestOrigin) allowed.add(requestOrigin);
  if (configuredOrigin) allowed.add(configuredOrigin);
  if (proxyOrigin) allowed.add(proxyOrigin);

  return allowed.has(origin);
}
