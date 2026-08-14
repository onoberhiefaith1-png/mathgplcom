CREATE OR REPLACE FUNCTION public.has_free_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff_codes c
    WHERE c.claimed_by = _user_id
      AND c.active
      AND c.revoked_at IS NULL
      AND (c.expires_at IS NULL OR c.expires_at > now())
  )
  OR EXISTS (
    SELECT 1
    FROM public.platform_test_accounts t
    JOIN public.user_roles r ON r.user_id = t.owner_user_id
    WHERE t.target_user_id = _user_id
      AND r.role IN ('platform_owner', 'co_admin')
  )
$$;

REVOKE ALL ON FUNCTION public.has_free_access(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.has_free_access(uuid) TO authenticated, service_role;