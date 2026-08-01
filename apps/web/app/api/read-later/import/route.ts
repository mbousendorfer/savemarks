import {
  readLaterBatchIngestSchema,
  readLaterCaptureSchema,
} from "@savemarks/shared";
import { readJson } from "../../../../lib/http";
import { startReadLaterEnrichment } from "../../../../lib/read-later-enrichment";
import { ingestReadLater } from "../../../../lib/read-later";
import { isSameOriginRequest } from "../../../../lib/request-origin";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Origin not allowed" }, { status: 403 });
  }
  const json = await readJson(request, 1_000_000);
  if (!json.ok) return json.response;
  const parsed = readLaterBatchIngestSchema.safeParse(json.value);
  if (!parsed.success) {
    return Response.json({ error: "Invalid import batch" }, { status: 400 });
  }
  const results: Array<{
    row: number;
    status: "created" | "updated" | "invalid";
    error?: string;
  }> = [];
  for (const entry of parsed.data.items) {
    const item = readLaterCaptureSchema.safeParse(entry.item);
    if (!item.success) {
      results.push({
        row: entry.row,
        status: "invalid",
        error: item.error.issues[0]?.message ?? "Invalid row",
      });
      continue;
    }
    try {
      const result = await ingestReadLater(item.data, "import");
      results.push({
        row: entry.row,
        status: result.created ? "created" : "updated",
      });
    } catch (error) {
      results.push({
        row: entry.row,
        status: "invalid",
        error:
          error instanceof Error
            ? error.message.slice(0, 500)
            : "Import failed",
      });
    }
  }
  void startReadLaterEnrichment(50);
  return Response.json({ results });
}
