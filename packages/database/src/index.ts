import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

let cached: ReturnType<typeof drizzle<typeof schema>> | undefined;

export function database(databaseUrl = process.env.DATABASE_URL) {
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  if (!cached) {
    const client = postgres(databaseUrl, {
      max: 10,
      prepare: false,
      connect_timeout: 5,
      idle_timeout: 30,
      max_lifetime: 60 * 30,
    });
    cached = drizzle(client, { schema });
  }
  return cached;
}

export * from "./media";
export * from "./schema";
