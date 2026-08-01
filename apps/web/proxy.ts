import { type NextRequest, NextResponse } from "next/server";
import {
  validBasicAuthorization,
  webCredentialsConfigured,
} from "./lib/web-auth";

function extensionRequest(request: NextRequest): boolean {
  const path = request.nextUrl.pathname;
  if (request.method === "OPTIONS") return true;
  if (path === "/api/pairing/exchange") return true;
  return (
    path === "/api/bookmarks" &&
    request.headers.get("authorization")?.startsWith("Bearer ") === true
  );
}

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/api/health" || extensionRequest(request)) {
    return NextResponse.next();
  }

  if (!webCredentialsConfigured()) {
    if (process.env.NODE_ENV !== "production") return NextResponse.next();
    return NextResponse.json(
      { error: "Web authentication is not configured" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (validBasicAuthorization(request.headers.get("authorization"))) {
    return NextResponse.next();
  }
  return new NextResponse("Authentication required", {
    status: 401,
    headers: {
      "Cache-Control": "no-store",
      "WWW-Authenticate": 'Basic realm="SaveMarks", charset="UTF-8"',
    },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
