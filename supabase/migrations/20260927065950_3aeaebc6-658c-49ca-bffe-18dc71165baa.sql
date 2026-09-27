DROP POLICY IF EXISTS gpl_usage_read_signed_in ON public.gpl_asset_usage;
CREATE POLICY gpl_usage_read_active_assets ON public.gpl_asset_usage
FOR SELECT TO authenticated
USING (
  public.can_manage_gpl_assets()
  OR EXISTS (SELECT 1 FROM public.gpl_assets a WHERE a.id = asset_id AND a.is_active)
);