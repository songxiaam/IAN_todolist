ALTER TABLE public.wrong_questions ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.practice_questions ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "wrong_questions_select"
ON public.wrong_questions FOR SELECT
TO authenticated
USING (
  get_my_family_id() IS NOT NULL
  AND family_id = get_my_family_id()
  AND (
    get_my_role() = 'parent'
    OR student_id = auth.uid()
  )
);
--> statement-breakpoint
CREATE POLICY "wrong_questions_insert_student"
ON public.wrong_questions FOR INSERT
TO authenticated
WITH CHECK (
  get_my_role() = 'student'
  AND student_id = auth.uid()
  AND family_id = get_my_family_id()
);
--> statement-breakpoint
CREATE POLICY "wrong_questions_update"
ON public.wrong_questions FOR UPDATE
TO authenticated
USING (
  get_my_family_id() IS NOT NULL
  AND family_id = get_my_family_id()
  AND (
    get_my_role() = 'parent'
    OR student_id = auth.uid()
  )
)
WITH CHECK (
  get_my_family_id() IS NOT NULL
  AND family_id = get_my_family_id()
);
--> statement-breakpoint
CREATE POLICY "wrong_questions_delete"
ON public.wrong_questions FOR DELETE
TO authenticated
USING (
  get_my_family_id() IS NOT NULL
  AND family_id = get_my_family_id()
  AND (
    get_my_role() = 'parent'
    OR student_id = auth.uid()
  )
);
--> statement-breakpoint
CREATE POLICY "practice_questions_select"
ON public.practice_questions FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM wrong_questions wq
    WHERE wq.id = practice_questions.wrong_question_id
      AND wq.family_id = get_my_family_id()
      AND (
        get_my_role() = 'parent'
        OR wq.student_id = auth.uid()
      )
  )
);
--> statement-breakpoint
CREATE POLICY "practice_questions_insert"
ON public.practice_questions FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM wrong_questions wq
    WHERE wq.id = practice_questions.wrong_question_id
      AND wq.family_id = get_my_family_id()
      AND (
        get_my_role() = 'parent'
        OR wq.student_id = auth.uid()
      )
  )
);
--> statement-breakpoint
CREATE POLICY "practice_questions_update"
ON public.practice_questions FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM wrong_questions wq
    WHERE wq.id = practice_questions.wrong_question_id
      AND wq.family_id = get_my_family_id()
      AND (
        get_my_role() = 'parent'
        OR wq.student_id = auth.uid()
      )
  )
);
