import { database, pairingCodes } from "@savemarks/database";
import { createPairingCode, hashSecret } from "../../../../lib/security";
import { rateLimit } from "../../../../lib/http";
import { isSameOriginRequest } from "../../../../lib/request-origin";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Origin not allowed" }, { status: 403 });
  }
  const limited = rateLimit(request, "pairing-code", 10, 10 * 60_000);
  if (limited) return limited;
  const code = createPairingCode();
  const expiresAt = new Date(Date.now() + 5 * 60_000);
  await database()
    .insert(pairingCodes)
    .values({
      codeHash: hashSecret(code),
      expiresAt,
    });
  return Response.json(
    { code, expiresAt: expiresAt.toISOString() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
