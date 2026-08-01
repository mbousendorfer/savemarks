import { database } from "@savemarks/database";
import { sql } from "drizzle-orm";

export async function GET() {
  const headers = { "Cache-Control": "no-store" };
  try {
    await database().execute(sql`select 1`);
    return Response.json(
      {
        status: "ok",
        service: "savemarks",
        version: 1,
        time: new Date().toISOString(),
      },
      { headers },
    );
  } catch {
    return Response.json(
      { status: "unavailable", service: "savemarks", version: 1 },
      { status: 503, headers },
    );
  }
}
