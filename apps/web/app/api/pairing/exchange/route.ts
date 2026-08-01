import { database, extensionClients, pairingCodes } from "@savemarks/database";
import { pairingExchangeSchema } from "@savemarks/shared";
import { and, eq, gt, isNull } from "drizzle-orm";
import { corsHeaders, originAllowed } from "../../../../lib/cors";
import { createApiToken, hashSecret } from "../../../../lib/security";
import { rateLimit, readJson } from "../../../../lib/http";

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: originAllowed(request) ? 204 : 403,
    headers: corsHeaders(request),
  });
}

export async function POST(request: Request) {
  const headers = corsHeaders(request);
  if (!originAllowed(request)) {
    return Response.json(
      { error: "Origin not allowed" },
      { status: 403, headers },
    );
  }

  const limited = rateLimit(request, "pairing-exchange", 20, 10 * 60_000);
  if (limited) {
    for (const [name, value] of new Headers(headers))
      limited.headers.set(name, value);
    return limited;
  }

  const json = await readJson(request, 8_192);
  if (!json.ok) {
    for (const [name, value] of new Headers(headers))
      json.response.headers.set(name, value);
    return json.response;
  }
  const parsed = pairingExchangeSchema.safeParse(json.value);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid pairing request" },
      { status: 400, headers },
    );
  }

  const codeHash = hashSecret(parsed.data.code);
  const token = createApiToken();
  const client = await database().transaction(async (tx) => {
    const [consumedCode] = await tx
      .update(pairingCodes)
      .set({ consumedAt: new Date() })
      .where(
        and(
          eq(pairingCodes.codeHash, codeHash),
          isNull(pairingCodes.consumedAt),
          gt(pairingCodes.expiresAt, new Date()),
        ),
      )
      .returning({ id: pairingCodes.id });
    if (!consumedCode) return null;

    const [createdClient] = await tx
      .insert(extensionClients)
      .values({
        name: parsed.data.clientName,
        tokenHash: hashSecret(token),
      })
      .returning({ id: extensionClients.id });
    return createdClient ?? null;
  });
  if (!client) {
    return Response.json(
      { error: "Pairing code is invalid or expired" },
      { status: 401, headers },
    );
  }

  return Response.json(
    { token, clientId: client.id },
    { headers: { ...headers, "Cache-Control": "no-store" } },
  );
}
