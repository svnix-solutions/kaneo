-- Candidates become contacts in pools (fork: svnix-solutions/kaneo).
--
-- Tables are renamed in place, so ids, values and task links carry over. Each
-- workspace that has candidates or candidate fields gets a "Nurse pool" (slug
-- "nurse"): the old fields become its fields, and every candidate becomes a
-- member. A member's id is its contact's id, so existing field values keep
-- pointing at the right row without being rewritten.

-- contact <- candidate
ALTER TABLE "candidate" RENAME TO "contact";--> statement-breakpoint
ALTER TABLE "contact" RENAME CONSTRAINT "candidate_pkey" TO "contact_pkey";--> statement-breakpoint
ALTER TABLE "contact" RENAME CONSTRAINT "candidate_workspace_external_id_unique" TO "contact_workspace_external_id_unique";--> statement-breakpoint
ALTER TABLE "contact" RENAME CONSTRAINT "candidate_workspace_id_workspace_id_fk" TO "contact_workspace_id_workspace_id_fk";--> statement-breakpoint
ALTER INDEX "candidate_workspace_name_idx" RENAME TO "contact_workspace_name_idx";--> statement-breakpoint
ALTER INDEX "candidate_workspace_phone_idx" RENAME TO "contact_workspace_phone_idx";--> statement-breakpoint
ALTER INDEX "candidate_workspace_email_idx" RENAME TO "contact_workspace_email_idx";--> statement-breakpoint

-- pools and members
CREATE TABLE "pool" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"icon" text,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	"updated_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	CONSTRAINT "pool_workspace_slug_unique" UNIQUE("workspace_id","slug")
);--> statement-breakpoint
ALTER TABLE "pool" ADD CONSTRAINT "pool_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE TABLE "pool_member" (
	"id" text PRIMARY KEY NOT NULL,
	"pool_id" text NOT NULL,
	"contact_id" text NOT NULL,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	"updated_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	CONSTRAINT "pool_member_pool_contact_unique" UNIQUE("pool_id","contact_id")
);--> statement-breakpoint
ALTER TABLE "pool_member" ADD CONSTRAINT "pool_member_pool_id_pool_id_fk" FOREIGN KEY ("pool_id") REFERENCES "public"."pool"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "pool_member" ADD CONSTRAINT "pool_member_contact_id_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "pool_member_contactId_idx" ON "pool_member" USING btree ("contact_id");--> statement-breakpoint

INSERT INTO "pool" ("id", "workspace_id", "name", "slug", "icon")
SELECT gen_random_uuid()::text, "workspace_id", 'Nurse pool', 'nurse', 'Stethoscope'
FROM (
	SELECT "workspace_id" FROM "contact"
	UNION
	SELECT "workspace_id" FROM "candidate_field_definition"
) AS "used";--> statement-breakpoint

INSERT INTO "pool_member" ("id", "pool_id", "contact_id", "created_at", "updated_at")
SELECT "contact"."id", "pool"."id", "contact"."id", "contact"."created_at", "contact"."updated_at"
FROM "contact"
JOIN "pool" ON "pool"."workspace_id" = "contact"."workspace_id" AND "pool"."slug" = 'nurse';--> statement-breakpoint

-- pool_field_definition <- candidate_field_definition (workspace -> pool)
ALTER TABLE "candidate_field_definition" RENAME TO "pool_field_definition";--> statement-breakpoint
ALTER TABLE "pool_field_definition" RENAME CONSTRAINT "candidate_field_definition_pkey" TO "pool_field_definition_pkey";--> statement-breakpoint
ALTER TABLE "pool_field_definition" ADD COLUMN "pool_id" text;--> statement-breakpoint
UPDATE "pool_field_definition" SET "pool_id" = "pool"."id"
FROM "pool"
WHERE "pool"."workspace_id" = "pool_field_definition"."workspace_id" AND "pool"."slug" = 'nurse';--> statement-breakpoint
ALTER TABLE "pool_field_definition" ALTER COLUMN "pool_id" SET NOT NULL;--> statement-breakpoint
DROP INDEX "candidate_field_def_workspace_name_unique";--> statement-breakpoint
ALTER TABLE "pool_field_definition" DROP CONSTRAINT "candidate_field_definition_workspace_id_workspace_id_fk";--> statement-breakpoint
ALTER TABLE "pool_field_definition" DROP COLUMN "workspace_id";--> statement-breakpoint
ALTER TABLE "pool_field_definition" ADD CONSTRAINT "pool_field_definition_pool_id_pool_id_fk" FOREIGN KEY ("pool_id") REFERENCES "public"."pool"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "pool_field_def_pool_name_unique" ON "pool_field_definition" USING btree ("pool_id",lower("name"));--> statement-breakpoint

-- pool_field_value <- candidate_field_value (candidate -> member, same ids)
ALTER TABLE "candidate_field_value" RENAME TO "pool_field_value";--> statement-breakpoint
ALTER TABLE "pool_field_value" RENAME CONSTRAINT "candidate_field_value_pkey" TO "pool_field_value_pkey";--> statement-breakpoint
ALTER TABLE "pool_field_value" DROP CONSTRAINT "candidate_field_value_candidate_id_candidate_id_fk";--> statement-breakpoint
ALTER TABLE "pool_field_value" RENAME COLUMN "candidate_id" TO "member_id";--> statement-breakpoint
ALTER TABLE "pool_field_value" ADD CONSTRAINT "pool_field_value_member_id_pool_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."pool_member"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "pool_field_value" RENAME CONSTRAINT "candidate_field_value_candidate_field_unique" TO "pool_field_value_member_field_unique";--> statement-breakpoint
ALTER TABLE "pool_field_value" RENAME CONSTRAINT "candidate_field_value_field_id_candidate_field_definition_id_fk" TO "pool_field_value_field_id_pool_field_definition_id_fk";--> statement-breakpoint
ALTER INDEX "candidate_field_value_fieldId_idx" RENAME TO "pool_field_value_fieldId_idx";--> statement-breakpoint

-- task_contact <- task_candidate
ALTER TABLE "task_candidate" RENAME TO "task_contact";--> statement-breakpoint
ALTER TABLE "task_contact" RENAME COLUMN "candidate_id" TO "contact_id";--> statement-breakpoint
ALTER TABLE "task_contact" RENAME CONSTRAINT "task_candidate_pkey" TO "task_contact_pkey";--> statement-breakpoint
ALTER TABLE "task_contact" RENAME CONSTRAINT "task_candidate_task_candidate_unique" TO "task_contact_task_contact_unique";--> statement-breakpoint
ALTER TABLE "task_contact" RENAME CONSTRAINT "task_candidate_task_id_task_id_fk" TO "task_contact_task_id_task_id_fk";--> statement-breakpoint
ALTER TABLE "task_contact" RENAME CONSTRAINT "task_candidate_candidate_id_candidate_id_fk" TO "task_contact_contact_id_contact_id_fk";--> statement-breakpoint
ALTER TABLE "task_contact" RENAME CONSTRAINT "task_candidate_created_by_user_id_fk" TO "task_contact_created_by_user_id_fk";--> statement-breakpoint
ALTER INDEX "task_candidate_candidateId_idx" RENAME TO "task_contact_contactId_idx";
