// Fork-only migration stream for the Candidates tables (see src/candidate/schema.ts).
import { config } from "dotenv-mono";
import { type Config, defineConfig } from "drizzle-kit";
import { resolveDatabaseConnectionString } from "./src/database/resolve-database-url";

config();

export default defineConfig({
  out: "./drizzle/candidates",
  schema: "./src/candidate/schema.ts",
  dialect: "postgresql",
  migrations: { table: "__drizzle_migrations_candidates" },
  dbCredentials: {
    url: resolveDatabaseConnectionString(),
  },
}) satisfies Config;
