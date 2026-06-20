DROP POLICY IF EXISTS "grading_questions_insert" ON public.grading_questions;
--> statement-breakpoint
CREATE POLICY "grading_questions_insert"
ON public.grading_questions FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM homework_gradings hg
    WHERE hg.id = grading_questions.grading_id
      AND hg.family_id = get_my_family_id()
      AND (
        hg.student_id = auth.uid()
        OR get_my_role() = 'parent'
      )
  )
);
--> statement-breakpoint
CREATE POLICY "homework_gradings_insert_parent"
ON public.homework_gradings FOR INSERT
TO authenticated
WITH CHECK (
  get_my_role() = 'parent'
  AND family_id = get_my_family_id()
  AND EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = student_id
      AND p.family_id = get_my_family_id()
      AND p.role = 'student'
  )
);
--> statement-breakpoint
CREATE POLICY "wrong_questions_insert_parent"
ON public.wrong_questions FOR INSERT
TO authenticated
WITH CHECK (
  get_my_role() = 'parent'
  AND family_id = get_my_family_id()
  AND EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = student_id
      AND p.family_id = get_my_family_id()
      AND p.role = 'student'
  )
);
