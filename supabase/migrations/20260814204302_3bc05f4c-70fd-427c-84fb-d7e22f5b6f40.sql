CREATE OR REPLACE FUNCTION public.get_account_homepage_config(_user_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.homepage_config
  FROM public.profiles p
  WHERE p.user_id = _user_id
    AND (
      _user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.connections c
        WHERE c.status = 'accepted'
          AND ((c.from_user_id = auth.uid() AND c.to_user_id = _user_id)
            OR (c.to_user_id = auth.uid() AND c.from_user_id = _user_id))
      )
    )
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.get_account_homepage_config(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_account_homepage_config(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_account_homepage_config(uuid) TO service_role;