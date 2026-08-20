-- 1. Elevated helpers should not be callable without signing in
REVOKE EXECUTE ON FUNCTION public.enter_workspace(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_free_access(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.resolve_account_code(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.resolve_share_code(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.lookup_session_by_code(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.lookup_class_by_code(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.student_may_access_owner(uuid, uuid, uuid) FROM anon;

-- Server-only helpers: not callable by app users at all
REVOKE EXECUTE ON FUNCTION public.redeem_access_code(text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.start_subscription_period(uuid, text, text, timestamptz, timestamptz, numeric, numeric, numeric) FROM authenticated;

-- 2. Asset usage telemetry is no longer world-readable
DROP POLICY IF EXISTS "gpl_usage_read" ON public.gpl_asset_usage;
CREATE POLICY "gpl_usage_read_managers" ON public.gpl_asset_usage
  FOR SELECT TO authenticated USING (public.can_manage_gpl_assets());
CREATE POLICY "gpl_usage_log" ON public.gpl_asset_usage
  FOR INSERT TO authenticated WITH CHECK (true);
REVOKE ALL ON public.gpl_asset_usage FROM anon;

-- 3. School owners see a member's board only when the teacher enabled sharing
DROP POLICY IF EXISTS "School reads member smartboard state" ON public.class_smartboard_state;
CREATE POLICY "School reads member smartboard state" ON public.class_smartboard_state
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = class_smartboard_state.class_id
        AND owner_can_access_user(c.owner_id)
        AND c.smartboard_visibility = 'student_access_enabled'
    )
  );

-- 4. Internal cost/profit rows are never streamed over realtime
ALTER PUBLICATION supabase_realtime DROP TABLE public.usage_events;