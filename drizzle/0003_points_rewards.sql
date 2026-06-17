ALTER TABLE "families"
ADD COLUMN IF NOT EXISTS "writeoff_salt" varchar(64),
ADD COLUMN IF NOT EXISTS "writeoff_password_hash" varchar(128);
--> statement-breakpoint
ALTER TABLE "profiles"
ADD COLUMN IF NOT EXISTS "points_balance" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "homeworks"
ADD COLUMN IF NOT EXISTS "points" integer DEFAULT 0 NOT NULL,
ADD COLUMN IF NOT EXISTS "review_status" varchar(20) DEFAULT 'none' NOT NULL,
ADD COLUMN IF NOT EXISTS "reviewed_at" timestamp with time zone,
ADD COLUMN IF NOT EXISTS "reviewed_by" uuid;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "homework_media" (
	"id" serial PRIMARY KEY NOT NULL,
	"homework_id" integer NOT NULL,
	"file_path" text NOT NULL,
	"media_type" varchar(20) NOT NULL,
	"uploaded_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "homework_media"
ADD CONSTRAINT "homework_media_homework_id_homeworks_id_fk"
FOREIGN KEY ("homework_id") REFERENCES "public"."homeworks"("id") ON DELETE CASCADE;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "homework_media_homework_id_idx" ON "homework_media" ("homework_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "gifts" (
	"id" serial PRIMARY KEY NOT NULL,
	"family_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"points_cost" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "gifts"
ADD CONSTRAINT "gifts_family_id_families_id_fk"
FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE CASCADE;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gifts_family_id_idx" ON "gifts" ("family_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vouchers" (
	"id" serial PRIMARY KEY NOT NULL,
	"gift_id" integer NOT NULL,
	"student_id" uuid NOT NULL,
	"family_id" uuid NOT NULL,
	"code" varchar(32) NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"points_spent" integer NOT NULL,
	"redeemed_at" timestamp with time zone,
	"redeemed_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vouchers"
ADD CONSTRAINT "vouchers_gift_id_gifts_id_fk"
FOREIGN KEY ("gift_id") REFERENCES "public"."gifts"("id") ON DELETE CASCADE;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "vouchers_code_unique_idx" ON "vouchers" ("code");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vouchers_student_id_idx" ON "vouchers" ("student_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vouchers_family_id_idx" ON "vouchers" ("family_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "point_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"profile_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"type" varchar(40) NOT NULL,
	"reference_type" varchar(40),
	"reference_id" varchar(64),
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "point_transactions_profile_id_idx" ON "point_transactions" ("profile_id");
