function unbracket(hostname: string): string {
  return hostname.replace(/^\[|\]$/g, "").toLowerCase();
}

function isPrivateIpv4(hostname: string): boolean {
  const octets = hostname.split(".").map(Number);
  if (
    octets.length !== 4 ||
    octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)
  ) {
    return false;
  }
  const [first, second] = octets as [number, number, number, number];
  return (
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}

export function isLocalServerHostname(hostname: string): boolean {
  const normalized = unbracket(hostname);
  return (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized.endsWith(".local") ||
    normalized === "::1" ||
    (normalized.includes(":") &&
      (normalized.startsWith("fc") || normalized.startsWith("fd"))) ||
    normalized.startsWith("fe80:") ||
    isPrivateIpv4(normalized)
  );
}

export function normalizeServerUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error("Enter a valid SaveMarks server URL");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Server URL must use HTTP or HTTPS");
  }
  if (url.username || url.password) {
    throw new Error("Do not include credentials in the server URL");
  }
  if (url.pathname !== "/" || url.search || url.hash) {
    throw new Error("Use only the server origin, without a path, query, or hash");
  }
  if (url.protocol === "http:" && !isLocalServerHostname(url.hostname)) {
    throw new Error("A remote SaveMarks server must use HTTPS");
  }

  return url.origin;
}

export function serverOriginPattern(value: string): string {
  return `${normalizeServerUrl(value)}/*`;
}
