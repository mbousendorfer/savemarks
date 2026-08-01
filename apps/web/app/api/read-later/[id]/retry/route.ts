import { retryReadLaterEnrichment } from "../../../../../lib/read-later-enrichment";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return Response.json({ error: "Origin not allowed" }, { status: 403 });
  }
  const { id } = await context.params;
  await retryReadLaterEnrichment(id);
  return Response.json({ ok: true });
}
