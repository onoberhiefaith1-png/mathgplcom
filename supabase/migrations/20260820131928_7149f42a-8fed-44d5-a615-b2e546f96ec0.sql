DROP POLICY IF EXISTS "gpl_usage_read_managers" ON public.gpl_asset_usage;
CREATE POLICY "gpl_usage_read_signed_in" ON public.gpl_asset_usage
  FOR SELECT TO authenticated USING (true);
GRANT SELECT, INSERT ON public.gpl_asset_usage TO authenticated;