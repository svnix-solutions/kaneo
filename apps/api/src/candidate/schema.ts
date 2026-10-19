// Candidates: workspace-scoped people records (fork: svnix-solutions/kaneo).
//
// Kept out of database/schema.ts on purpose: these tables have their own
// drizzle-kit config (drizzle.candidates.config.ts) and migration stream
// (drizzle/candidates, tracked in __drizzle_migrations_candidates), so
// upstream schema changes and migrations never conflict with them.
import { createId } from "@paralleldrive/cuid2";
import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { taskTable, userTable, workspaceTable } from "../database/schema";

const utcNow = sql`(now() AT TIME ZONE 'utc')`;

export const candidateTable = pgTable(
  "candidate",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaceTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    name: text("name").notNull(),
    phone: text("phone"),
    email: text("email"),
    // Id in the source system (e.g. the CRM / ad lead id). Unique per workspace.
    externalId: text("external_id"),
    source: text("source"),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .default(utcNow)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    unique("candidate_workspace_external_id_unique").on(
      table.workspaceId,
      table.externalId,
    ),
    index("candidate_workspace_name_idx").on(table.workspaceId, table.name),
    index("candidate_workspace_phone_idx").on(table.workspaceId, table.phone),
    index("candidate_workspace_email_idx").on(table.workspaceId, table.email),
  ],
);

export const candidateFieldDefinitionTable = pgTable(
  "candidate_field_definition",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaceTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    name: text("name").notNull(),
    type: text("type").notNull(), // text | number | date | dropdown | boolean | multiselect
    required: boolean("required").default(false).notNull(),
    defaultValue: text("default_value"),
    options: jsonb("options"),
    position: integer("position").default(0).notNull(),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .default(utcNow)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    // Case-insensitive name per workspace, so "create if missing" is race-safe.
    uniqueIndex("candidate_field_def_workspace_name_unique").on(
      table.workspaceId,
      sql`lower(${table.name})`,
    ),
  ],
);

export const candidateFieldValueTable = pgTable(
  "candidate_field_value",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    candidateId: text("candidate_id")
      .notNull()
      .references(() => candidateTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    fieldId: text("field_id")
      .notNull()
      .references(() => candidateFieldDefinitionTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    value: text("value"),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .default(utcNow)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    unique("candidate_field_value_candidate_field_unique").on(
      table.candidateId,
      table.fieldId,
    ),
    index("candidate_field_value_fieldId_idx").on(table.fieldId),
  ],
);

export const taskCandidateTable = pgTable(
  "task_candidate",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    taskId: text("task_id")
      .notNull()
      .references(() => taskTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    candidateId: text("candidate_id")
      .notNull()
      .references(() => candidateTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    createdBy: text("created_by").references(() => userTable.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
  },
  (table) => [
    unique("task_candidate_task_candidate_unique").on(
      table.taskId,
      table.candidateId,
    ),
    index("task_candidate_candidateId_idx").on(table.candidateId),
  ],
);
