const configuredOrigins = new Set([
  ...(process.env.SAVEMARKS_ALLOWED_EXTENSION_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .map((id) => `chrome-extension://${id}`),
  ...(process.env.SAVEMARKS_DEV_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
]);

export function corsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get("origin");
  if (!origin || !configuredOrigins.has(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

export function originAllowed(request: Request): boolean {
  const origin = request.headers.get("origin");
  return origin === null || configuredOrigins.has(origin);
}
