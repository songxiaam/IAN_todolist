CREATE TABLE IF NOT EXISTS "wrong_questions" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_id" uuid NOT NULL,
	"family_id" uuid NOT NULL,
	"subject" varchar(50) DEFAULT '其他' NOT NULL,
	"image_path" text NOT NULL,
	"question_text" text,
	"student_answer" text,
	"correct_answer" text,
	"error_analysis" text,
	"knowledge_points" text,
	"mastered" boolean DEFAULT false NOT NULL,
	"review_count" integer DEFAULT 0 NOT NULL,
	"last_reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "wrong_questions"
ADD CONSTRAINT "wrong_questions_family_id_families_id_fk"
FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE CASCADE;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "wrong_questions_student_id_idx" ON "wrong_questions" ("student_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "wrong_questions_family_id_idx" ON "wrong_questions" ("family_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "practice_questions" (
	"id" serial PRIMARY KEY NOT NULL,
	"wrong_question_id" integer NOT NULL,
	"question_text" text NOT NULL,
	"question_type" varchar(20) DEFAULT 'fill' NOT NULL,
	"options" text,
	"answer" text NOT NULL,
	"explanation" text,
	"student_answer" text,
	"is_correct" boolean,
	"answered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "practice_questions"
ADD CONSTRAINT "practice_questions_wrong_question_id_fk"
FOREIGN KEY ("wrong_question_id") REFERENCES "public"."wrong_questions"("id") ON DELETE CASCADE;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "practice_questions_wrong_question_id_idx" ON "practice_questions" ("wrong_question_id");
