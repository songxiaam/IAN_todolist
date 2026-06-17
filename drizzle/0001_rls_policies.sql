-- 获取当前登录用户的 family_id（避免 RLS 策略递归）
CREATE OR REPLACE FUNCTION public.get_my_family_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT family_id FROM profiles WHERE id = auth.uid();
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS varchar
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;
--> statement-breakpoint
ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.homeworks ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
-- families: 已登录用户可创建家庭、按 id 查询（加入家庭时验证家庭码）
CREATE POLICY "families_select_authenticated"
ON public.families FOR SELECT
TO authenticated
USING (true);
--> statement-breakpoint
CREATE POLICY "families_insert_authenticated"
ON public.families FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid());
--> statement-breakpoint
-- profiles: 只能创建自己的资料，可查看同家庭成员
CREATE POLICY "profiles_select_same_family"
ON public.profiles FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR (
    get_my_family_id() IS NOT NULL
    AND family_id = get_my_family_id()
  )
);
--> statement-breakpoint
CREATE POLICY "profiles_insert_own"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());
--> statement-breakpoint
CREATE POLICY "profiles_update_own"
ON public.profiles FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());
--> statement-breakpoint
-- homeworks: 家庭成员可查看，家长可创建/删除，成员可更新
CREATE POLICY "homeworks_select_same_family"
ON public.homeworks FOR SELECT
TO authenticated
USING (
  get_my_family_id() IS NOT NULL
  AND family_id = get_my_family_id()
);
--> statement-breakpoint
CREATE POLICY "homeworks_insert_parent"
ON public.homeworks FOR INSERT
TO authenticated
WITH CHECK (
  get_my_family_id() IS NOT NULL
  AND family_id = get_my_family_id()
  AND get_my_role() = 'parent'
  AND created_by = auth.uid()
);
--> statement-breakpoint
CREATE POLICY "homeworks_update_same_family"
ON public.homeworks FOR UPDATE
TO authenticated
USING (
  get_my_family_id() IS NOT NULL
  AND family_id = get_my_family_id()
)
WITH CHECK (
  get_my_family_id() IS NOT NULL
  AND family_id = get_my_family_id()
);
--> statement-breakpoint
CREATE POLICY "homeworks_delete_parent"
ON public.homeworks FOR DELETE
TO authenticated
USING (
  get_my_family_id() IS NOT NULL
  AND family_id = get_my_family_id()
  AND get_my_role() = 'parent'
);
