REVOKE EXECUTE ON FUNCTION public.course_assigned_to_my_class(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.course_assigned_to_my_class(uuid) TO authenticated, service_role;