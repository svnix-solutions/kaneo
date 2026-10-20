CREATE TABLE "task_pool_member" (
	"id" text PRIMARY KEY NOT NULL,
	"task_id" text NOT NULL,
	"member_id" text NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	CONSTRAINT "task_pool_member_task_member_unique" UNIQUE("task_id","member_id")
);
--> statement-breakpoint
ALTER TABLE "task_pool_member" ADD CONSTRAINT "task_pool_member_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "task_pool_member" ADD CONSTRAINT "task_pool_member_member_id_pool_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."pool_member"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "task_pool_member" ADD CONSTRAINT "task_pool_member_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "task_pool_member_memberId_idx" ON "task_pool_member" USING btree ("member_id");