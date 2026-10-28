-- Remove anon EXECUTE from all SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.get_owned_class_codes() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_class_member(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_class_owner(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.lookup_profile_by_student_id(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.notebook_shared_to_member(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.shares_class_with(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.lookup_class_by_code(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.accept_class_invitation(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_class_join_code(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_class_member_names(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_class_join_request_profiles(uuid) FROM anon;

-- Internal trigger functions: no direct client execution at all
REVOKE EXECUTE ON FUNCTION public.handle_new_class_join_code() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_player_stats() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_profile() FROM anon, authenticated;