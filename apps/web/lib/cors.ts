const chromeExtensionOrigin = /^chrome-extension:\/\/[a-p]{32}$/;

function configuredExtensionIds(): string[] {
  return (process.env.SAVEMARKS_ALLOWED_EXTENSION_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

function configuredOrigins(): Set<string> {
  return new Set([
    ...configuredExtensionIds().map((id) => `chrome-extension://${id}`),
    ...(process.env.SAVEMARKS_DEV_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  ]);
}

function isAllowedOrigin(origin: string): boolean {
  if (configuredOrigins().has(origin)) return true;

  return (
    process.env.NODE_ENV === "development" &&
    configuredExtensionIds().length === 0 &&
    chromeExtensionOrigin.test(origin)
  );
}

export function corsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get("origin");
  if (!origin || !isAllowedOrigin(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

export function originAllowed(request: Request): boolean {
  const origin = request.headers.get("origin");
  return origin === null || isAllowedOrigin(origin);
}
