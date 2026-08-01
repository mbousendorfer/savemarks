export type JsonResult =
  { ok: true; value: unknown } | { ok: false; response: Response };

export async function readJson(
  request: Request,
  maxBytes = 256_000,
): Promise<JsonResult> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > maxBytes) {
    return {
      ok: false,
      response: Response.json(
        { error: "Request body too large" },
        { status: 413 },
      ),
    };
  }

  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > maxBytes) {
    return {
      ok: false,
      response: Response.json(
        { error: "Request body too large" },
        { status: 413 },
      ),
    };
  }
  try {
    return { ok: true, value: JSON.parse(body) };
  } catch {
    return {
      ok: false,
      response: Response.json({ error: "Invalid JSON" }, { status: 400 }),
    };
  }
}

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export function rateLimit(
  request: Request,
  scope: string,
  limit: number,
  windowMs: number,
): Response | undefined {
  const forwarded = request.headers
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  const client = forwarded || request.headers.get("x-real-ip") || "local";
  const key = `${scope}:${client}`;
  const now = Date.now();
  const current = buckets.get(key);
  const bucket =
    !current || current.resetAt <= now
      ? { count: 1, resetAt: now + windowMs }
      : { ...current, count: current.count + 1 };
  buckets.set(key, bucket);

  if (buckets.size > 2_000) {
    for (const [entryKey, entry] of buckets) {
      if (entry.resetAt <= now) buckets.delete(entryKey);
    }
  }
  if (bucket.count <= limit) return undefined;

  return Response.json(
    { error: "Too many requests" },
    {
      status: 429,
      headers: {
        "Retry-After": String(
          Math.max(1, Math.ceil((bucket.resetAt - now) / 1_000)),
        ),
      },
    },
  );
}
