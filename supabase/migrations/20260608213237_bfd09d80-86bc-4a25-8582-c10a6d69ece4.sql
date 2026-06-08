-- 1. Notebook owner policies: restrict to authenticated
DROP POLICY "owner all blocks" ON public.notebook_blocks;
CREATE POLICY "owner all blocks" ON public.notebook_blocks
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.notebook_sections s JOIN public.notebooks n ON n.id = s.notebook_id WHERE s.id = notebook_blocks.section_id AND n.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.notebook_sections s JOIN public.notebooks n ON n.id = s.notebook_id WHERE s.id = notebook_blocks.section_id AND n.owner_id = auth.uid()));

DROP POLICY "owner all sections" ON public.notebook_sections;
CREATE POLICY "owner all sections" ON public.notebook_sections
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.notebooks n WHERE n.id = notebook_sections.notebook_id AND n.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.notebooks n WHERE n.id = notebook_sections.notebook_id AND n.owner_id = auth.uid()));

DROP POLICY "owner all subsections" ON public.notebook_subsections;
CREATE POLICY "owner all subsections" ON public.notebook_subsections
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.notebook_sections s JOIN public.notebooks n ON n.id = s.notebook_id WHERE s.id = notebook_subsections.section_id AND n.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.notebook_sections s JOIN public.notebooks n ON n.id = s.notebook_id WHERE s.id = notebook_subsections.section_id AND n.owner_id = auth.uid()));

DROP POLICY "owner read notebooks" ON public.notebooks;
CREATE POLICY "owner read notebooks" ON public.notebooks FOR SELECT TO authenticated USING (auth.uid() = owner_id);
DROP POLICY "owner insert notebooks" ON public.notebooks;
CREATE POLICY "owner insert notebooks" ON public.notebooks FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
DROP POLICY "owner update notebooks" ON public.notebooks;
CREATE POLICY "owner update notebooks" ON public.notebooks FOR UPDATE TO authenticated USING (auth.uid() = owner_id);
DROP POLICY "owner delete notebooks" ON public.notebooks;
CREATE POLICY "owner delete notebooks" ON public.notebooks FOR DELETE TO authenticated USING (auth.uid() = owner_id);

-- 2. player_stats: restrict to authenticated
DROP POLICY "Players insert own stats" ON public.player_stats;
CREATE POLICY "Players insert own stats" ON public.player_stats FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY "Players read own stats" ON public.player_stats;
CREATE POLICY "Players read own stats" ON public.player_stats FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY "Players update own stats" ON public.player_stats;
CREATE POLICY "Players update own stats" ON public.player_stats FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- 3. class_smartboard_state active-student policy: restrict to authenticated
DROP POLICY "Active student writes board state" ON public.class_smartboard_state;
CREATE POLICY "Active student writes board state" ON public.class_smartboard_state
  FOR UPDATE TO authenticated
  USING ((active_student_id = auth.uid()) AND is_class_member(class_id))
  WITH CHECK ((active_student_id = auth.uid()) AND is_class_member(class_id));

-- 4. profiles: only the owner may read their own profile
DROP POLICY "Users read own or classmate profiles" ON public.profiles;
CREATE POLICY "Users read own profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- 4b. Access-checked lookups so teachers can still see member / requester info
CREATE OR REPLACE FUNCTION public.get_class_member_names(_class_id uuid)
RETURNS TABLE(user_id uuid, display_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.user_id, p.display_name
  FROM public.class_members m
  JOIN public.profiles p ON p.user_id = m.user_id
  WHERE m.class_id = _class_id
    AND (public.is_class_owner(_class_id) OR public.is_class_member(_class_id));
$$;

CREATE OR REPLACE FUNCTION public.get_class_join_request_profiles(_class_id uuid)
RETURNS TABLE(user_id uuid, display_name text, mathgpl_student_id text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.user_id, p.display_name, p.mathgpl_student_id
  FROM public.class_join_requests r
  JOIN public.profiles p ON p.user_id = r.requester_id
  WHERE r.class_id = _class_id
    AND r.status = 'pending'
    AND public.is_class_owner(_class_id);
$$;

-- 5. Lock down SECURITY DEFINER function execution (remove default PUBLIC/anon access)
-- 5a. Functions needed by signed-in users (RLS helpers + client RPCs)
REVOKE EXECUTE ON FUNCTION public.is_class_member(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_class_member(uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.is_class_owner(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_class_owner(uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.notebook_shared_to_member(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notebook_shared_to_member(uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.shares_class_with(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.shares_class_with(uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.get_owned_class_codes() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_owned_class_codes() TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.get_class_join_code(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_class_join_code(uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.lookup_class_by_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_class_by_code(text) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.lookup_profile_by_student_id(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_profile_by_student_id(text) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.accept_class_invitation(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_class_invitation(uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.get_class_member_names(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_class_member_names(uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.get_class_join_request_profiles(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_class_join_request_profiles(uuid) TO authenticated, service_role;

-- 5b. Internal-only functions (triggers / generators): service_role only
REVOKE EXECUTE ON FUNCTION public.generate_mathgpl_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_mathgpl_id() TO service_role;
REVOKE EXECUTE ON FUNCTION public.handle_new_class_join_code() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_new_class_join_code() TO service_role;
REVOKE EXECUTE ON FUNCTION public.handle_new_player_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_new_player_stats() TO service_role;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_profile() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_new_user_profile() TO service_role;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.touch_updated_at() TO service_role;