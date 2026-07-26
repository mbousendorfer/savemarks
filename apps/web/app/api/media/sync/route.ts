import { startMediaSync } from "../../../../lib/media-download";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return Response.json({ error: "Origin not allowed" }, { status: 403 });
  }
  void startMediaSync();
  return Response.json({ started: true }, { status: 202 });
}

