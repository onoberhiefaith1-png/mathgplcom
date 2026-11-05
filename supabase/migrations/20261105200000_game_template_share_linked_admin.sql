-- Admin-linked accounts can share game templates.
--
-- A platform owner or co-admin can have linked test accounts (teacher, school,
-- parent, student) in platform_test_accounts. Those accounts count as admin for
-- sharing, the same way they already do for tutorials (can_manage_tutorials).

CREATE OR REPLACE FUNCTION public.can_share_game_library()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_flow_admin(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.platform_test_accounts t
      WHERE t.target_user_id = auth.uid()
        AND public.is_flow_admin(t.owner_user_id)
    )
    OR EXISTS (
      SELECT 1
      FROM public.staff_codes c
      WHERE c.claimed_by = auth.uid()
        AND c.purpose = 'access'
        AND c.active
        AND c.revoked_at IS NULL
        AND (c.expires_at IS NULL OR c.expires_at > now())
    );
$$;

REVOKE ALL ON FUNCTION public.can_share_game_library() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_share_game_library() TO authenticated, service_role;
