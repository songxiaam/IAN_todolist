ALTER TABLE public.homework_gradings ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.grading_questions ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "homework_gradings_select"
ON public.homework_gradings FOR SELECT
TO authenticated
USING (
  get_my_family_id() IS NOT NULL
  AND family_id = get_my_family_id()
  AND (get_my_role() = 'parent' OR student_id = auth.uid())
);
--> statement-breakpoint
CREATE POLICY "homework_gradings_insert_student"
ON public.homework_gradings FOR INSERT
TO authenticated
WITH CHECK (
  get_my_role() = 'student'
  AND student_id = auth.uid()
  AND family_id = get_my_family_id()
);
--> statement-breakpoint
CREATE POLICY "homework_gradings_delete"
ON public.homework_gradings FOR DELETE
TO authenticated
USING (
  get_my_family_id() IS NOT NULL
  AND family_id = get_my_family_id()
  AND (get_my_role() = 'parent' OR student_id = auth.uid())
);
--> statement-breakpoint
CREATE POLICY "grading_questions_select"
ON public.grading_questions FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM homework_gradings hg
    WHERE hg.id = grading_questions.grading_id
      AND hg.family_id = get_my_family_id()
      AND (get_my_role() = 'parent' OR hg.student_id = auth.uid())
  )
);
--> statement-breakpoint
CREATE POLICY "grading_questions_insert"
ON public.grading_questions FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM homework_gradings hg
    WHERE hg.id = grading_questions.grading_id
      AND hg.family_id = get_my_family_id()
      AND hg.student_id = auth.uid()
  )
);
--> statement-breakpoint
CREATE POLICY "grading_questions_update"
ON public.grading_questions FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM homework_gradings hg
    WHERE hg.id = grading_questions.grading_id
      AND hg.family_id = get_my_family_id()
      AND (get_my_role() = 'parent' OR hg.student_id = auth.uid())
  )
);
