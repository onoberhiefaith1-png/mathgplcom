DROP POLICY IF EXISTS "workspace building selection read" ON public.workspace_building_selection;
CREATE POLICY "workspace building selection read"
  ON public.workspace_building_selection
  FOR SELECT TO authenticated
  USING (public.can_view_workspace(org_id) OR public.is_building_admin(auth.uid()));
REVOKE SELECT ON public.workspace_building_selection FROM anon;