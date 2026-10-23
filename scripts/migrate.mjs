// Applies drizzle/ migrations at deploy time. Plain JS with runtime deps only,
// so it works after the build has pruned dev dependencies.
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}
const client = postgres(url, { max: 1, onnotice: () => {} });
await migrate(drizzle(client), { migrationsFolder: "drizzle" });
await client.end();
console.log("migrations applied");
