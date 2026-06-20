CREATE TABLE IF NOT EXISTS "homework_gradings" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_id" uuid NOT NULL,
	"family_id" uuid NOT NULL,
	"subject" varchar(50) DEFAULT '其他' NOT NULL,
	"original_image_path" text NOT NULL,
	"question_count" integer DEFAULT 0 NOT NULL,
	"correct_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "homework_gradings"
ADD CONSTRAINT "homework_gradings_family_id_fk"
FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE CASCADE;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "homework_gradings_student_id_idx" ON "homework_gradings" ("student_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "homework_gradings_family_id_idx" ON "homework_gradings" ("family_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "grading_questions" (
	"id" serial PRIMARY KEY NOT NULL,
	"grading_id" integer NOT NULL,
	"question_index" integer NOT NULL,
	"crop_image_path" text NOT NULL,
	"crop_bbox" text NOT NULL,
	"question_text" text,
	"student_answer" text,
	"correct_answer" text,
	"solution_steps" text,
	"is_correct" boolean,
	"feedback" text,
	"wrong_question_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "grading_questions"
ADD CONSTRAINT "grading_questions_grading_id_fk"
FOREIGN KEY ("grading_id") REFERENCES "public"."homework_gradings"("id") ON DELETE CASCADE;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "grading_questions_grading_id_idx" ON "grading_questions" ("grading_id");
--> statement-breakpoint
ALTER TABLE "wrong_questions"
ADD COLUMN IF NOT EXISTS "source_type" varchar(20) DEFAULT 'crop' NOT NULL,
ADD COLUMN IF NOT EXISTS "source_grading_question_id" integer,
ADD COLUMN IF NOT EXISTS "original_image_path" text,
ADD COLUMN IF NOT EXISTS "crop_bbox" text,
ADD COLUMN IF NOT EXISTS "solution_steps" text,
ADD COLUMN IF NOT EXISTS "mastery_level" integer DEFAULT 0 NOT NULL;
