ALTER TABLE public.gifts ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.vouchers ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.homework_media ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "gifts_select_same_family"
ON public.gifts FOR SELECT
TO authenticated
USING (
  get_my_family_id() IS NOT NULL
  AND family_id = get_my_family_id()
);
--> statement-breakpoint
CREATE POLICY "gifts_insert_parent"
ON public.gifts FOR INSERT
TO authenticated
WITH CHECK (
  get_my_family_id() IS NOT NULL
  AND family_id = get_my_family_id()
  AND get_my_role() = 'parent'
  AND created_by = auth.uid()
);
--> statement-breakpoint
CREATE POLICY "vouchers_select_family_or_own"
ON public.vouchers FOR SELECT
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
CREATE POLICY "homework_media_select_same_family"
ON public.homework_media FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM homeworks h
    WHERE h.id = homework_media.homework_id
      AND h.family_id = get_my_family_id()
  )
);
