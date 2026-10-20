// Fork-only migration stream for the contact and pool tables (see src/contact/schema.ts).
// The folder and tracking-table names predate pools and stay for continuity.
import { config } from "dotenv-mono";
import { type Config, defineConfig } from "drizzle-kit";
import { resolveDatabaseConnectionString } from "./src/database/resolve-database-url";

config();

export default defineConfig({
  out: "./drizzle/candidates",
  schema: "./src/contact/schema.ts",
  dialect: "postgresql",
  migrations: { table: "__drizzle_migrations_candidates" },
  dbCredentials: {
    url: resolveDatabaseConnectionString(),
  },
}) satisfies Config;
