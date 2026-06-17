ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "username" varchar(30);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "profiles_student_username_unique_idx"
ON "profiles" ("username")
WHERE "role" = 'student' AND "username" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "profiles_username_idx" ON "profiles" USING btree ("username");
