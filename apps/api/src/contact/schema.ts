// Contacts and pools (fork: svnix-solutions/kaneo).
//
// A contact is one person (name, phone, email, the source system's id). A pool
// (Nurse pool, Electrician pool, ...) is a workspace list like a project: it
// has its own field definitions, and a contact joins it as a pool member that
// holds that pool's field values. Tasks link to contacts.
//
// Kept out of database/schema.ts on purpose: these tables have their own
// drizzle-kit config (drizzle.candidates.config.ts) and migration stream
// (drizzle/candidates, tracked in __drizzle_migrations_candidates; the names
// predate pools), so upstream schema changes and migrations never conflict.
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
const timestamps = {
  createdAt: timestamp("created_at", { mode: "date" })
    .default(utcNow)
    .notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .default(utcNow)
    .$onUpdate(() => new Date())
    .notNull(),
};
const cascade = { onDelete: "cascade", onUpdate: "cascade" } as const;

export const contactTable = pgTable(
  "contact",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaceTable.id, cascade),
    name: text("name").notNull(),
    phone: text("phone"),
    email: text("email"),
    // Id in the source system (e.g. the CRM / ad lead id). Unique per workspace.
    externalId: text("external_id"),
    source: text("source"),
    ...timestamps,
  },
  (table) => [
    unique("contact_workspace_external_id_unique").on(
      table.workspaceId,
      table.externalId,
    ),
    index("contact_workspace_name_idx").on(table.workspaceId, table.name),
    index("contact_workspace_phone_idx").on(table.workspaceId, table.phone),
    index("contact_workspace_email_idx").on(table.workspaceId, table.email),
  ],
);

export const poolTable = pgTable(
  "pool",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaceTable.id, cascade),
    name: text("name").notNull(),
    // Stable handle for integrations (e.g. a workflow's "pool": "nurse").
    slug: text("slug").notNull(),
    description: text("description"),
    icon: text("icon"),
    position: integer("position").default(0).notNull(),
    ...timestamps,
  },
  (table) => [
    unique("pool_workspace_slug_unique").on(table.workspaceId, table.slug),
  ],
);

export const poolMemberTable = pgTable(
  "pool_member",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    poolId: text("pool_id")
      .notNull()
      .references(() => poolTable.id, cascade),
    contactId: text("contact_id")
      .notNull()
      .references(() => contactTable.id, cascade),
    ...timestamps,
  },
  (table) => [
    unique("pool_member_pool_contact_unique").on(table.poolId, table.contactId),
    index("pool_member_contactId_idx").on(table.contactId),
  ],
);

export const poolFieldDefinitionTable = pgTable(
  "pool_field_definition",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    poolId: text("pool_id")
      .notNull()
      .references(() => poolTable.id, cascade),
    name: text("name").notNull(),
    type: text("type").notNull(), // text | number | date | dropdown | boolean | multiselect
    required: boolean("required").default(false).notNull(),
    defaultValue: text("default_value"),
    options: jsonb("options"),
    position: integer("position").default(0).notNull(),
    ...timestamps,
  },
  (table) => [
    // Case-insensitive name per pool, so "create if missing" is race-safe.
    uniqueIndex("pool_field_def_pool_name_unique").on(
      table.poolId,
      sql`lower(${table.name})`,
    ),
  ],
);

export const poolFieldValueTable = pgTable(
  "pool_field_value",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    memberId: text("member_id")
      .notNull()
      .references(() => poolMemberTable.id, cascade),
    fieldId: text("field_id")
      .notNull()
      .references(() => poolFieldDefinitionTable.id, cascade),
    value: text("value"),
    ...timestamps,
  },
  (table) => [
    unique("pool_field_value_member_field_unique").on(
      table.memberId,
      table.fieldId,
    ),
    index("pool_field_value_fieldId_idx").on(table.fieldId),
  ],
);

export const taskContactTable = pgTable(
  "task_contact",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    taskId: text("task_id")
      .notNull()
      .references(() => taskTable.id, cascade),
    contactId: text("contact_id")
      .notNull()
      .references(() => contactTable.id, cascade),
    createdBy: text("created_by").references(() => userTable.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
  },
  (table) => [
    unique("task_contact_task_contact_unique").on(
      table.taskId,
      table.contactId,
    ),
    index("task_contact_contactId_idx").on(table.contactId),
  ],
);
