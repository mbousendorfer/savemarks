import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const migrationsFolder =
  process.env.SAVEMARKS_MIGRATIONS_PATH ?? "/app/drizzle";
const client = postgres(databaseUrl, { max: 1, prepare: false });

try {
  await migrate(drizzle(client), { migrationsFolder });
  console.log("Database migrations are up to date.");
} finally {
  await client.end();
}
