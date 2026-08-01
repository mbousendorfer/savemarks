import { retryReadLaterEnrichment } from "../../../../../lib/read-later-enrichment";
import { isSameOriginRequest } from "../../../../../lib/request-origin";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Origin not allowed" }, { status: 403 });
  }
  const { id } = await context.params;
  await retryReadLaterEnrichment(id);
  return Response.json({ ok: true });
}
