REVOKE EXECUTE ON FUNCTION public.lookup_class_by_code(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.lookup_profile_by_student_id(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_class_owner(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_class_member(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_class_join_code(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_owned_class_codes() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.shares_class_with(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.notebook_shared_to_member(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.generate_mathgpl_id() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.lookup_class_by_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_profile_by_student_id(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_class_owner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_class_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_class_join_code(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_owned_class_codes() TO authenticated;
GRANT EXECUTE ON FUNCTION public.shares_class_with(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.notebook_shared_to_member(uuid) TO authenticated;