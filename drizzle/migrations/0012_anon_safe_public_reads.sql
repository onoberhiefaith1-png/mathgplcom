ALTER POLICY gpl_sessions_read_active ON public.gpl_asset_sessions TO authenticated;
CREATE POLICY gpl_sessions_read_active_anon ON public.gpl_asset_sessions FOR SELECT TO anon USING (is_active);
ALTER POLICY gpl_subsessions_read_active ON public.gpl_asset_subsessions TO authenticated;
CREATE POLICY gpl_subsessions_read_active_anon ON public.gpl_asset_subsessions FOR SELECT TO anon USING (is_active);
ALTER POLICY gpl_assets_read_active ON public.gpl_assets TO authenticated;
CREATE POLICY gpl_assets_read_active_anon ON public.gpl_assets FOR SELECT TO anon USING (is_active);
ALTER POLICY gpl_usage_read_active_assets ON public.gpl_asset_usage TO authenticated;
CREATE POLICY gpl_usage_read_active_assets_anon ON public.gpl_asset_usage FOR SELECT TO anon
  USING (EXISTS (SELECT 1 FROM public.gpl_assets a WHERE a.id = gpl_asset_usage.asset_id AND a.is_active));
ALTER POLICY "Anyone can read active advertisements" ON public.platform_advertisements TO authenticated;
CREATE POLICY "Signed-out can read active advertisements" ON public.platform_advertisements FOR SELECT TO anon USING (is_active = true);
ALTER POLICY "Anyone can read published sections" ON public.site_sections TO authenticated;
CREATE POLICY "Signed-out can read published sections" ON public.site_sections FOR SELECT TO anon USING (published_at IS NOT NULL);
ALTER POLICY "Anyone can read approved testimonials" ON public.site_testimonials TO authenticated;
CREATE POLICY "Signed-out can read approved testimonials" ON public.site_testimonials FOR SELECT TO anon USING (approved);