import { database, pairingCodes } from "@savemarks/database";
import { createPairingCode, hashSecret } from "../../../../lib/security";

export async function POST() {
  const code = createPairingCode();
  const expiresAt = new Date(Date.now() + 5 * 60_000);
  await database().insert(pairingCodes).values({
    codeHash: hashSecret(code),
    expiresAt,
  });
  return Response.json(
    { code, expiresAt: expiresAt.toISOString() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
