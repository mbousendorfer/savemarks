import { database, mediaAssets, resolveMediaPath } from "@savemarks/database";
import { eq } from "drizzle-orm";
import { readFile } from "node:fs/promises";
import { mediaRoot } from "../../../../lib/media-download";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const [asset] = await database()
    .select({
      mimeType: mediaAssets.mimeType,
      localRelativePath: mediaAssets.localRelativePath,
      status: mediaAssets.status,
    })
    .from(mediaAssets)
    .where(eq(mediaAssets.id, id))
    .limit(1);
  if (!asset || asset.status !== "stored" || !asset.localRelativePath) {
    return Response.json({ error: "Media not stored" }, { status: 404 });
  }
  try {
    const bytes = await readFile(
      resolveMediaPath(mediaRoot(), asset.localRelativePath),
    );
    return new Response(bytes, {
      headers: {
        "content-type": asset.mimeType ?? "application/octet-stream",
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return Response.json({ error: "Media file missing" }, { status: 404 });
  }
}

