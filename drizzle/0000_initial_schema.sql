CREATE TABLE IF NOT EXISTS "families" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "families"
ADD CONSTRAINT "families_created_by_auth_users_id_fk"
FOREIGN KEY ("created_by") REFERENCES auth.users("id") ON DELETE SET NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"role" varchar(20) DEFAULT 'student' NOT NULL,
	"family_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "profiles"
ADD CONSTRAINT "profiles_id_auth_users_id_fk"
FOREIGN KEY ("id") REFERENCES auth.users("id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "profiles"
ADD CONSTRAINT "profiles_family_id_families_id_fk"
FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE CASCADE;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "profiles_family_id_idx" ON "profiles" USING btree ("family_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "profiles_role_idx" ON "profiles" USING btree ("role");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "homeworks" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text,
	"subject" varchar(50) NOT NULL,
	"deadline" timestamp with time zone,
	"estimated_minutes" integer DEFAULT 30 NOT NULL,
	"family_id" uuid NOT NULL,
	"created_by" uuid NOT NULL,
	"assigned_to" uuid,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "homeworks"
ADD CONSTRAINT "homeworks_family_id_families_id_fk"
FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "homeworks"
ADD CONSTRAINT "homeworks_created_by_profiles_id_fk"
FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "homeworks"
ADD CONSTRAINT "homeworks_assigned_to_profiles_id_fk"
FOREIGN KEY ("assigned_to") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "homeworks_family_id_idx" ON "homeworks" USING btree ("family_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "homeworks_created_by_idx" ON "homeworks" USING btree ("created_by");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "homeworks_assigned_to_idx" ON "homeworks" USING btree ("assigned_to");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "homeworks_status_idx" ON "homeworks" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "homeworks_deadline_idx" ON "homeworks" USING btree ("deadline");
