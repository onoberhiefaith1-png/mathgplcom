REVOKE ALL ON FUNCTION public.ensure_user_cost_unit(uuid) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.ensure_workspace_cost_unit(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_user_cost_unit(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.ensure_workspace_cost_unit(uuid) TO service_role;