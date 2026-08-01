import { bookmarkTags, bookmarks, database, tags } from "@savemarks/database";
import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { readJson } from "../../../../../lib/http";

const updateTagsSchema = z.object({
  tags: z
    .array(
      z
        .string()
        .trim()
        .min(1)
        .max(50)
        .regex(/^[^#\s,]+(?: [^#\s,]+)*$/),
    )
    .max(20)
    .transform((values) => [
      ...new Set(values.map((value) => value.toLocaleLowerCase())),
    ]),
});

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return Response.json({ error: "Origin not allowed" }, { status: 403 });
  }
  const json = await readJson(request, 8_192);
  if (!json.ok) return json.response;
  const parsed = updateTagsSchema.safeParse(json.value);
  if (!parsed.success) {
    return Response.json({ error: "Invalid tags" }, { status: 400 });
  }
  const { id } = await context.params;
  const updated = await database().transaction(async (tx) => {
    const [bookmark] = await tx
      .select({ id: bookmarks.id })
      .from(bookmarks)
      .where(eq(bookmarks.id, id))
      .limit(1);
    if (!bookmark) return null;

    await tx.delete(bookmarkTags).where(eq(bookmarkTags.bookmarkId, id));
    if (parsed.data.tags.length === 0) return [];

    await tx
      .insert(tags)
      .values(parsed.data.tags.map((name) => ({ name })))
      .onConflictDoNothing({ target: tags.name });
    const resolved = await tx
      .select({ id: tags.id, name: tags.name })
      .from(tags)
      .where(inArray(tags.name, parsed.data.tags));
    if (resolved.length > 0) {
      await tx
        .insert(bookmarkTags)
        .values(resolved.map((tag) => ({ bookmarkId: id, tagId: tag.id })));
    }
    return resolved.map((tag) => tag.name).sort();
  });

  if (updated === null) {
    return Response.json({ error: "Bookmark not found" }, { status: 404 });
  }
  return Response.json({ tags: updated });
}
