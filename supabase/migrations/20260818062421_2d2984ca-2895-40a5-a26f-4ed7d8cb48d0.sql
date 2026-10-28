REVOKE EXECUTE ON FUNCTION public.can_manage_gpl_assets() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.can_manage_gpl_assets() TO authenticated, service_role;