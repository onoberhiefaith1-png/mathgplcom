REVOKE ALL ON FUNCTION public.parent_child_overview() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.parent_family_connections() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.parent_family_activity() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.parent_child_overview() TO authenticated;
GRANT EXECUTE ON FUNCTION public.parent_family_connections() TO authenticated;
GRANT EXECUTE ON FUNCTION public.parent_family_activity() TO authenticated;