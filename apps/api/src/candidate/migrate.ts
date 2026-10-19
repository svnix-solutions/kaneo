import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

// Applies the fork-only Candidates migration stream. Runs after upstream's
// migrations (its tables reference workspace/task/user) and is tracked in its
// own table, so upstream migration history is never touched.
export async function migrateCandidates(
  database: NodePgDatabase<Record<string, unknown>>,
  drizzleDir: string,
) {
  await migrate(database, {
    migrationsFolder: `${drizzleDir}/candidates`,
    migrationsTable: "__drizzle_migrations_candidates",
  });
}
