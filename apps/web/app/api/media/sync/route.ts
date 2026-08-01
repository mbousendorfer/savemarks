import { startMediaSync } from "../../../../lib/media-download";
import { isSameOriginRequest } from "../../../../lib/request-origin";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Origin not allowed" }, { status: 403 });
  }
  void startMediaSync();
  return Response.json({ started: true }, { status: 202 });
}
