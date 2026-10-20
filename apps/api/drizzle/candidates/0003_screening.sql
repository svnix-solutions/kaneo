-- Screening: contact priority and target pools, each pool's screening board,
-- and per-board message steps (Typebot message flows run by the glue).
ALTER TABLE "contact" ADD COLUMN "priority" text DEFAULT 'no-priority' NOT NULL;--> statement-breakpoint
ALTER TABLE "pool" ADD COLUMN "screening_project_id" text;--> statement-breakpoint
ALTER TABLE "pool" ADD CONSTRAINT "pool_screening_project_id_project_id_fk" FOREIGN KEY ("screening_project_id") REFERENCES "public"."project"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE TABLE "contact_target_pool" (
	"id" text PRIMARY KEY NOT NULL,
	"contact_id" text NOT NULL,
	"pool_id" text NOT NULL,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	CONSTRAINT "contact_target_pool_contact_pool_unique" UNIQUE("contact_id","pool_id")
);--> statement-breakpoint
ALTER TABLE "contact_target_pool" ADD CONSTRAINT "contact_target_pool_contact_id_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "contact_target_pool" ADD CONSTRAINT "contact_target_pool_pool_id_pool_id_fk" FOREIGN KEY ("pool_id") REFERENCES "public"."pool"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "contact_target_pool_poolId_idx" ON "contact_target_pool" USING btree ("pool_id");--> statement-breakpoint
CREATE TABLE "project_message_step" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"name" text NOT NULL,
	"typebot_public_id" text NOT NULL,
	"offset_days" integer DEFAULT 0 NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	"updated_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL
);--> statement-breakpoint
ALTER TABLE "project_message_step" ADD CONSTRAINT "project_message_step_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "project_message_step_projectId_idx" ON "project_message_step" USING btree ("project_id");
