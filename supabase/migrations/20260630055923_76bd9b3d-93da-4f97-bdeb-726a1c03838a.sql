
-- 1) Private schema for helpers
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated, anon;

CREATE OR REPLACE FUNCTION private.is_class_member(_class_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.class_members WHERE class_id = _class_id AND user_id = auth.uid())
$$;

CREATE OR REPLACE FUNCTION private.is_class_owner(_class_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.classes WHERE id = _class_id AND owner_id = auth.uid())
$$;

CREATE OR REPLACE FUNCTION private.notebook_shared_to_member(_notebook_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.class_lesson_notes cln
    JOIN public.class_members cm ON cm.class_id = cln.class_id
    WHERE cln.notebook_id = _notebook_id
      AND cln.visibility = 'student_access_enabled'
      AND cm.user_id = auth.uid()
  )
$$;

CREATE OR REPLACE FUNCTION private.shares_class_with(_other uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.classes c JOIN public.class_members m ON m.class_id = c.id
    WHERE c.owner_id = auth.uid() AND m.user_id = _other
  ) OR EXISTS (
    SELECT 1 FROM public.classes c JOIN public.class_members m ON m.class_id = c.id
    WHERE c.owner_id = _other AND m.user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.class_members a JOIN public.class_members b ON a.class_id = b.class_id
    WHERE a.user_id = auth.uid() AND b.user_id = _other
  )
$$;

CREATE OR REPLACE FUNCTION private.can_access_realtime_topic(_topic text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid(); cid uuid; aid uuid; raw text;
BEGIN
  IF uid IS NULL OR _topic IS NULL THEN RETURN false; END IF;
  IF _topic LIKE 'member-of-%' THEN RETURN _topic = 'member-of-' || uid::text; END IF;
  IF _topic LIKE 'join-requests-%' THEN
    raw := substring(_topic FROM length('join-requests-') + 1);
    BEGIN cid := raw::uuid; EXCEPTION WHEN others THEN RETURN false; END;
    RETURN private.is_class_owner(cid);
  END IF;
  IF _topic LIKE 'assessment-progress-%' THEN
    raw := substring(_topic FROM length('assessment-progress-') + 1);
    BEGIN aid := raw::uuid; EXCEPTION WHEN others THEN RETURN false; END;
    SELECT a.class_id INTO cid FROM public.assessments a WHERE a.id = aid;
    IF cid IS NULL THEN RETURN false; END IF;
    RETURN private.is_class_owner(cid) OR private.is_class_member(cid);
  END IF;
  IF _topic LIKE 'sb-sync-%' THEN raw := substring(_topic FROM length('sb-sync-') + 1);
  ELSIF _topic LIKE 'smartboard-state-%' THEN raw := substring(_topic FROM length('smartboard-state-') + 1);
  ELSIF _topic LIKE 'class-visibility-%' THEN raw := substring(_topic FROM length('class-visibility-') + 1);
  ELSIF _topic LIKE 'class-notes-%' THEN raw := substring(_topic FROM length('class-notes-') + 1);
  ELSIF _topic LIKE 'active-student-members-%' THEN raw := substring(_topic FROM length('active-student-members-') + 1);
  ELSIF _topic LIKE 'class-assessments-%' THEN raw := substring(_topic FROM length('class-assessments-') + 1);
  ELSE RETURN false; END IF;
  BEGIN cid := raw::uuid; EXCEPTION WHEN others THEN RETURN false; END;
  RETURN private.is_class_owner(cid) OR private.is_class_member(cid);
END;
$$;

GRANT EXECUTE ON FUNCTION private.is_class_member(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION private.is_class_owner(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION private.notebook_shared_to_member(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION private.shares_class_with(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION private.can_access_realtime_topic(text) TO authenticated, anon;

-- 2) Drop dependent policies
DROP POLICY IF EXISTS "Active student writes board state" ON public.class_smartboard_state;
DROP POLICY IF EXISTS "Members read board when enabled" ON public.class_smartboard_state;
DROP POLICY IF EXISTS "Owner writes board state" ON public.class_smartboard_state;
DROP POLICY IF EXISTS "Members can view their class" ON public.classes;
DROP POLICY IF EXISTS "Members read class assessments" ON public.assessments;
DROP POLICY IF EXISTS "Owner manages assessments" ON public.assessments;
DROP POLICY IF EXISTS "Members read shared notebook blocks" ON public.notebook_blocks;
DROP POLICY IF EXISTS "Members read shared notebook sections" ON public.notebook_sections;
DROP POLICY IF EXISTS "Members read shared notebook subsections" ON public.notebook_subsections;
DROP POLICY IF EXISTS "Members read shared notebooks" ON public.notebooks;
DROP POLICY IF EXISTS "Members read visible class notes" ON public.class_lesson_notes;
DROP POLICY IF EXISTS "Owner manages class notes" ON public.class_lesson_notes;
DROP POLICY IF EXISTS "Owner manages invitations" ON public.class_invitations;
DROP POLICY IF EXISTS "Owner manages members" ON public.class_members;

-- Drop old public helpers
DROP FUNCTION IF EXISTS public.is_class_member(uuid);
DROP FUNCTION IF EXISTS public.is_class_owner(uuid);
DROP FUNCTION IF EXISTS public.notebook_shared_to_member(uuid);
DROP FUNCTION IF EXISTS public.shares_class_with(uuid);
DROP FUNCTION IF EXISTS public.can_access_realtime_topic(text);

-- 3) Recreate policies using private.* helpers (matching original semantics)
CREATE POLICY "Active student writes board state" ON public.class_smartboard_state
  FOR UPDATE TO authenticated
  USING (active_student_id = auth.uid() AND private.is_class_member(class_id))
  WITH CHECK (active_student_id = auth.uid() AND private.is_class_member(class_id));

CREATE POLICY "Members read board when enabled" ON public.class_smartboard_state
  FOR SELECT TO authenticated
  USING (private.is_class_member(class_id) AND EXISTS (
    SELECT 1 FROM public.classes c
    WHERE c.id = class_smartboard_state.class_id AND c.smartboard_visibility = 'student_access_enabled'
  ));

CREATE POLICY "Owner writes board state" ON public.class_smartboard_state
  FOR ALL TO authenticated
  USING (private.is_class_owner(class_id))
  WITH CHECK (private.is_class_owner(class_id));

CREATE POLICY "Members can view their class" ON public.classes
  FOR SELECT TO authenticated
  USING (private.is_class_member(id));

CREATE POLICY "Members read class assessments" ON public.assessments
  FOR SELECT TO authenticated
  USING (private.is_class_member(class_id));

CREATE POLICY "Owner manages assessments" ON public.assessments
  FOR ALL TO authenticated
  USING (private.is_class_owner(class_id))
  WITH CHECK (private.is_class_owner(class_id));

CREATE POLICY "Members read shared notebooks" ON public.notebooks
  FOR SELECT TO authenticated
  USING (private.notebook_shared_to_member(id));

CREATE POLICY "Members read shared notebook sections" ON public.notebook_sections
  FOR SELECT TO authenticated
  USING (private.notebook_shared_to_member(notebook_id));

CREATE POLICY "Members read shared notebook subsections" ON public.notebook_subsections
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.notebook_sections s
    WHERE s.id = notebook_subsections.section_id AND private.notebook_shared_to_member(s.notebook_id)
  ));

CREATE POLICY "Members read shared notebook blocks" ON public.notebook_blocks
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.notebook_sections s
    WHERE s.id = notebook_blocks.section_id AND private.notebook_shared_to_member(s.notebook_id)
  ));

CREATE POLICY "Members read visible class notes" ON public.class_lesson_notes
  FOR SELECT TO authenticated
  USING (visibility = 'student_access_enabled' AND private.is_class_member(class_id));

CREATE POLICY "Owner manages class notes" ON public.class_lesson_notes
  FOR ALL TO authenticated
  USING (private.is_class_owner(class_id))
  WITH CHECK (private.is_class_owner(class_id));

CREATE POLICY "Owner manages invitations" ON public.class_invitations
  FOR ALL TO authenticated
  USING (private.is_class_owner(class_id))
  WITH CHECK (private.is_class_owner(class_id));

CREATE POLICY "Owner manages members" ON public.class_members
  FOR ALL TO authenticated
  USING (private.is_class_owner(class_id))
  WITH CHECK (private.is_class_owner(class_id));

-- 4) Lock down trigger / generator functions
REVOKE EXECUTE ON FUNCTION public.handle_new_class_join_code() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_profile() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_player_stats() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_mathgpl_id() FROM PUBLIC, anon, authenticated;

-- 5) Block anon from RPC SECURITY DEFINER functions; keep authenticated
REVOKE EXECUTE ON FUNCTION public.lookup_class_by_code(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.lookup_profile_by_student_id(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_class_join_code(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_class_join_request_profiles(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_class_member_names(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_owned_class_codes() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.accept_class_invitation(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.lookup_class_by_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_profile_by_student_id(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_class_join_code(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_class_join_request_profiles(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_class_member_names(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_owned_class_codes() TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_class_invitation(uuid) TO authenticated;

-- 6) reference-images storage policies (user-folder scoped)
CREATE POLICY "owner reads own reference-images" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'reference-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "owner uploads own reference-images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'reference-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "owner updates own reference-images" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'reference-images' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'reference-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "owner deletes own reference-images" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'reference-images' AND (storage.foldername(name))[1] = auth.uid()::text);
