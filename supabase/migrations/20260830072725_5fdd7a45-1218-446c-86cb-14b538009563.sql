DROP POLICY IF EXISTS "academies_insert" ON public.academies;
CREATE POLICY "academies_insert" ON public.academies
FOR INSERT TO authenticated
WITH CHECK (
  owner_id = auth.uid()
  AND (
    org_id IS NULL
    OR public.is_workspace_member(org_id)
    OR public.is_org_owner(org_id)
  )
);