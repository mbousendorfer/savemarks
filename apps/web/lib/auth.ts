import { database, extensionClients } from "@savemarks/database";
import { and, eq, isNull } from "drizzle-orm";
import { hashSecret } from "./security";

export async function authenticate(request: Request) {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length);
  const [client] = await database()
    .select()
    .from(extensionClients)
    .where(
      and(
        eq(extensionClients.tokenHash, hashSecret(token)),
        isNull(extensionClients.revokedAt),
      ),
    )
    .limit(1);
  return client ?? null;
}
