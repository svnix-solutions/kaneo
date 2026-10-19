CREATE TABLE "candidate_field_definition" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"required" boolean DEFAULT false NOT NULL,
	"default_value" text,
	"options" jsonb,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	"updated_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "candidate_field_value" (
	"id" text PRIMARY KEY NOT NULL,
	"candidate_id" text NOT NULL,
	"field_id" text NOT NULL,
	"value" text,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	"updated_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	CONSTRAINT "candidate_field_value_candidate_field_unique" UNIQUE("candidate_id","field_id")
);
--> statement-breakpoint
CREATE TABLE "candidate" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"email" text,
	"external_id" text,
	"source" text,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	"updated_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	CONSTRAINT "candidate_workspace_external_id_unique" UNIQUE("workspace_id","external_id")
);
--> statement-breakpoint
CREATE TABLE "task_candidate" (
	"id" text PRIMARY KEY NOT NULL,
	"task_id" text NOT NULL,
	"candidate_id" text NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	CONSTRAINT "task_candidate_task_candidate_unique" UNIQUE("task_id","candidate_id")
);
--> statement-breakpoint
ALTER TABLE "candidate_field_definition" ADD CONSTRAINT "candidate_field_definition_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "candidate_field_value" ADD CONSTRAINT "candidate_field_value_candidate_id_candidate_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidate"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "candidate_field_value" ADD CONSTRAINT "candidate_field_value_field_id_candidate_field_definition_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."candidate_field_definition"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "candidate" ADD CONSTRAINT "candidate_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "task_candidate" ADD CONSTRAINT "task_candidate_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "task_candidate" ADD CONSTRAINT "task_candidate_candidate_id_candidate_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidate"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "task_candidate" ADD CONSTRAINT "task_candidate_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "candidate_field_def_workspace_name_unique" ON "candidate_field_definition" USING btree ("workspace_id",lower("name"));--> statement-breakpoint
CREATE INDEX "candidate_field_value_fieldId_idx" ON "candidate_field_value" USING btree ("field_id");--> statement-breakpoint
CREATE INDEX "candidate_workspace_name_idx" ON "candidate" USING btree ("workspace_id","name");--> statement-breakpoint
CREATE INDEX "candidate_workspace_phone_idx" ON "candidate" USING btree ("workspace_id","phone");--> statement-breakpoint
CREATE INDEX "candidate_workspace_email_idx" ON "candidate" USING btree ("workspace_id","email");--> statement-breakpoint
CREATE INDEX "task_candidate_candidateId_idx" ON "task_candidate" USING btree ("candidate_id");