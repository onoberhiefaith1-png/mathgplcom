DROP POLICY IF EXISTS "academies_read" ON public.academies;
CREATE POLICY "academies_read" ON public.academies
FOR SELECT TO authenticated
USING (
  owner_id = auth.uid()
  OR (org_id IS NOT NULL AND public.is_workspace_member(org_id))
  OR public.has_role(auth.uid(), 'platform_owner')
  OR public.has_role(auth.uid(), 'co_admin')
);