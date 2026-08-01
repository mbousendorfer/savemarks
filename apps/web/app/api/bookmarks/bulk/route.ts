import {
  addTagToBookmarks,
  archiveBookmarks,
  deleteBookmarks,
} from "../../../../lib/bookmark-actions";
import { readJson } from "../../../../lib/http";
import { isSameOriginRequest } from "../../../../lib/request-origin";
import { z } from "zod";

const ids = z.array(z.string().uuid()).min(1).max(500);
const bulkActionSchema = z.discriminatedUnion("action", [
  z
    .object({ action: z.literal("archive"), ids, archived: z.boolean() })
    .strict(),
  z
    .object({
      action: z.literal("add_tag"),
      ids,
      tag: z
        .string()
        .trim()
        .min(1)
        .max(50)
        .regex(/^[^#\s,]+(?: [^#\s,]+)*$/)
        .transform((value) => value.toLocaleLowerCase()),
    })
    .strict(),
  z.object({ action: z.literal("delete"), ids }).strict(),
]);

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Origin not allowed" }, { status: 403 });
  }
  const json = await readJson(request, 64_000);
  if (!json.ok) return json.response;
  const parsed = bulkActionSchema.safeParse(json.value);
  if (!parsed.success) {
    return Response.json({ error: "Invalid bulk action" }, { status: 400 });
  }

  let updatedIds: string[];
  if (parsed.data.action === "archive") {
    updatedIds = await archiveBookmarks(parsed.data.ids, parsed.data.archived);
  } else if (parsed.data.action === "add_tag") {
    updatedIds = await addTagToBookmarks(parsed.data.ids, parsed.data.tag);
  } else {
    updatedIds = await deleteBookmarks(parsed.data.ids);
  }
  return Response.json({ ids: updatedIds, affected: updatedIds.length });
}
