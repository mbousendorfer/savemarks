import { bookmarks, database } from "@savemarks/database";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { readJson } from "../../../../lib/http";

const updateBookmarkSchema = z
  .object({ archived: z.boolean().optional(), read: z.boolean().optional() })
  .strict()
  .refine((value) => value.archived !== undefined || value.read !== undefined);

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return Response.json({ error: "Origin not allowed" }, { status: 403 });
  }
  const json = await readJson(request, 1_024);
  if (!json.ok) return json.response;
  const parsed = updateBookmarkSchema.safeParse(json.value);
  if (!parsed.success) {
    return Response.json({ error: "Invalid bookmark update" }, { status: 400 });
  }
  const { id } = await context.params;
  const [updated] = await database()
    .update(bookmarks)
    .set({
      ...(parsed.data.archived !== undefined
        ? { archived: parsed.data.archived }
        : {}),
      ...(parsed.data.read !== undefined
        ? { readAt: parsed.data.read ? new Date() : null }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(bookmarks.id, id))
    .returning({
      id: bookmarks.id,
      archived: bookmarks.archived,
      readAt: bookmarks.readAt,
    });
  if (!updated) {
    return Response.json({ error: "Bookmark not found" }, { status: 404 });
  }
  return Response.json({
    ...updated,
    readAt: updated.readAt?.toISOString() ?? null,
  });
}
