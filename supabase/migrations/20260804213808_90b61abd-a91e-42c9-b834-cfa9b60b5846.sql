CREATE OR REPLACE FUNCTION public.get_org_homepage_config()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.homepage_config
  FROM public.organizations o
  JOIN public.profiles p ON p.user_id = o.owner_user_id
  WHERE o.id = public.org_of(auth.uid())
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.get_org_homepage_config() TO authenticated;