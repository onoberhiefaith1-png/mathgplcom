-- Academia write rules: UPDATE/DELETE of topics, subtopics, sessions and
-- activities is limited to the school owner or the row's creator.
-- INSERT stays open to assigned subject teachers, and is also allowed for
-- the school owner. Classes and subjects stay owner-only (unchanged).
--
-- NULL created_by (legacy or unset rows) can be updated or deleted only by
-- the school owner. New inserts fill created_by with auth.uid() when it is
-- omitted. created_by cannot be changed later.
--
-- Activities added by a second teacher inside a session: that teacher may
-- update or delete their own activity; the school owner and the teacher who
-- created the session may also update or delete any activity in that
-- session (so the session organiser can still arrange it). Reorder of a
-- tier batch is a session-organisation act: school owner or session
-- creator only. Duplicate remains a SECURITY DEFINER RPC with its existing
-- authority check (owner, or assigned teacher for non-class items) and is
-- unchanged here; sibling position updates inside that RPC still work.
--
-- Idempotent: safe to re-run. Does not change class/subject policies.
-- This file is not applied by the app; Lovable must run it on the project
-- database before the new UI permissions match production.

CREATE OR REPLACE FUNCTION public.academia_lock_created_by()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.created_by IS NULL THEN
      NEW.created_by := auth.uid();
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'created_by cannot be changed'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.academia_lock_created_by() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.academia_can_manage_session(_session uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_org_owner(public.academia_org_of_session(_session))
      OR EXISTS (
        SELECT 1 FROM public.academia_sessions s
        WHERE s.id = _session AND s.created_by = auth.uid()
      )
$$;
CREATE OR REPLACE FUNCTION public.academia_can_manage_activity(_activity uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.academia_activities a
    JOIN public.academia_sessions s ON s.id = a.session_id
    WHERE a.id = _activity
      AND (
        public.is_org_owner(public.academia_org_of_session(a.session_id))
        OR a.created_by = auth.uid()
        OR s.created_by = auth.uid()
      )
  )
$$;
REVOKE ALL ON FUNCTION public.academia_can_manage_session(uuid), public.academia_can_manage_activity(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.academia_can_manage_session(uuid), public.academia_can_manage_activity(uuid) TO authenticated;

DROP TRIGGER IF EXISTS academia_topics_lock_created_by ON public.academia_topics;
CREATE TRIGGER academia_topics_lock_created_by
  BEFORE INSERT OR UPDATE ON public.academia_topics
  FOR EACH ROW EXECUTE FUNCTION public.academia_lock_created_by();

DROP TRIGGER IF EXISTS academia_subtopics_lock_created_by ON public.academia_subtopics;
CREATE TRIGGER academia_subtopics_lock_created_by
  BEFORE INSERT OR UPDATE ON public.academia_subtopics
  FOR EACH ROW EXECUTE FUNCTION public.academia_lock_created_by();

DROP TRIGGER IF EXISTS academia_sessions_lock_created_by ON public.academia_sessions;
CREATE TRIGGER academia_sessions_lock_created_by
  BEFORE INSERT OR UPDATE ON public.academia_sessions
  FOR EACH ROW EXECUTE FUNCTION public.academia_lock_created_by();

DROP TRIGGER IF EXISTS academia_activities_lock_created_by ON public.academia_activities;
CREATE TRIGGER academia_activities_lock_created_by
  BEFORE INSERT OR UPDATE ON public.academia_activities
  FOR EACH ROW EXECUTE FUNCTION public.academia_lock_created_by();

-- Replace the previous FOR ALL "teachers build …" policies with split
-- INSERT vs UPDATE/DELETE rules.
DROP POLICY IF EXISTS "teachers build topics" ON public.academia_topics;
DROP POLICY IF EXISTS "teachers or owner insert topics" ON public.academia_topics;
DROP POLICY IF EXISTS "owner or creator update topics" ON public.academia_topics;
DROP POLICY IF EXISTS "owner or creator delete topics" ON public.academia_topics;
CREATE POLICY "teachers or owner insert topics" ON public.academia_topics
  FOR INSERT TO authenticated
  WITH CHECK (
    (public.academia_can_build_subject(subject_id) OR public.is_org_owner(public.academia_org_of_subject(subject_id)))
    AND (created_by IS NULL OR created_by = auth.uid())
  );
CREATE POLICY "owner or creator update topics" ON public.academia_topics
  FOR UPDATE TO authenticated
  USING (public.is_org_owner(public.academia_org_of_subject(subject_id)) OR created_by = auth.uid())
  WITH CHECK (public.is_org_owner(public.academia_org_of_subject(subject_id)) OR created_by = auth.uid());
CREATE POLICY "owner or creator delete topics" ON public.academia_topics
  FOR DELETE TO authenticated
  USING (public.is_org_owner(public.academia_org_of_subject(subject_id)) OR created_by = auth.uid());

DROP POLICY IF EXISTS "teachers build subtopics" ON public.academia_subtopics;
DROP POLICY IF EXISTS "teachers or owner insert subtopics" ON public.academia_subtopics;
DROP POLICY IF EXISTS "owner or creator update subtopics" ON public.academia_subtopics;
DROP POLICY IF EXISTS "owner or creator delete subtopics" ON public.academia_subtopics;
CREATE POLICY "teachers or owner insert subtopics" ON public.academia_subtopics
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      public.academia_can_build_subject((SELECT subject_id FROM public.academia_topics WHERE id = topic_id))
      OR public.is_org_owner(public.academia_org_of_subject((SELECT subject_id FROM public.academia_topics WHERE id = topic_id)))
    )
    AND (created_by IS NULL OR created_by = auth.uid())
  );
CREATE POLICY "owner or creator update subtopics" ON public.academia_subtopics
  FOR UPDATE TO authenticated
  USING (
    public.is_org_owner(public.academia_org_of_subject((SELECT subject_id FROM public.academia_topics WHERE id = topic_id)))
    OR created_by = auth.uid()
  )
  WITH CHECK (
    public.is_org_owner(public.academia_org_of_subject((SELECT subject_id FROM public.academia_topics WHERE id = topic_id)))
    OR created_by = auth.uid()
  );
CREATE POLICY "owner or creator delete subtopics" ON public.academia_subtopics
  FOR DELETE TO authenticated
  USING (
    public.is_org_owner(public.academia_org_of_subject((SELECT subject_id FROM public.academia_topics WHERE id = topic_id)))
    OR created_by = auth.uid()
  );

DROP POLICY IF EXISTS "teachers build sessions" ON public.academia_sessions;
DROP POLICY IF EXISTS "teachers or owner insert sessions" ON public.academia_sessions;
DROP POLICY IF EXISTS "owner or creator update sessions" ON public.academia_sessions;
DROP POLICY IF EXISTS "owner or creator delete sessions" ON public.academia_sessions;
CREATE POLICY "teachers or owner insert sessions" ON public.academia_sessions
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      public.academia_can_build_subject(public.academia_subject_of_subtopic(subtopic_id))
      OR public.is_org_owner(public.academia_org_of_subject(public.academia_subject_of_subtopic(subtopic_id)))
    )
    AND (created_by IS NULL OR created_by = auth.uid())
  );
CREATE POLICY "owner or creator update sessions" ON public.academia_sessions
  FOR UPDATE TO authenticated
  USING (public.academia_can_manage_session(id))
  WITH CHECK (public.academia_can_manage_session(id));
CREATE POLICY "owner or creator delete sessions" ON public.academia_sessions
  FOR DELETE TO authenticated
  USING (public.academia_can_manage_session(id));

DROP POLICY IF EXISTS "teachers build activities" ON public.academia_activities;
DROP POLICY IF EXISTS "teachers or owner insert activities" ON public.academia_activities;
DROP POLICY IF EXISTS "owner or creator update activities" ON public.academia_activities;
DROP POLICY IF EXISTS "owner or creator delete activities" ON public.academia_activities;
CREATE POLICY "teachers or owner insert activities" ON public.academia_activities
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      public.academia_can_build_subject(public.academia_subject_of_session(session_id))
      OR public.is_org_owner(public.academia_org_of_session(session_id))
    )
    AND (created_by IS NULL OR created_by = auth.uid())
  );
-- Session organiser, activity creator, or school owner — see header comment.
CREATE POLICY "owner or creator update activities" ON public.academia_activities
  FOR UPDATE TO authenticated
  USING (public.academia_can_manage_activity(id))
  WITH CHECK (public.academia_can_manage_activity(id));
CREATE POLICY "owner or creator delete activities" ON public.academia_activities
  FOR DELETE TO authenticated
  USING (public.academia_can_manage_activity(id));

-- Keep the existing reorder contract (complete single-tier batch, no
-- cross-session/cross-tier moves). Only the authority check changes.
CREATE OR REPLACE FUNCTION public.academia_reorder_tier(_session uuid, _tier text, _ids uuid[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_signed_in'; END IF;
  IF _tier IS NULL OR _tier NOT IN ('beginner','intermediate','expert') THEN RAISE EXCEPTION 'bad_tier'; END IF;
  -- School owner or the teacher who created the session. Another assigned
  -- teacher can still add, edit or remove their own activities, but cannot
  -- rearrange the batch. A session with NULL created_by is owner-only.
  IF NOT public.academia_can_manage_session(_session) THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(coalesce(_ids, '{}'::uuid[])) AS u(aid)
    LEFT JOIN public.academia_activities a ON a.id = u.aid
    WHERE a.id IS NULL OR a.session_id <> _session OR a.tier <> _tier
  ) THEN
    RAISE EXCEPTION 'cross_tier_move: activities can only be reordered inside their own tier'
      USING ERRCODE = 'check_violation';
  END IF;
  SELECT count(*) INTO v_count FROM public.academia_activities WHERE session_id = _session AND tier = _tier;
  IF v_count <> coalesce(cardinality(_ids), 0)
     OR v_count <> (SELECT count(DISTINCT u.aid) FROM unnest(_ids) AS u(aid)) THEN
    RAISE EXCEPTION 'reorder_incomplete: send every activity of the tier once';
  END IF;
  UPDATE public.academia_activities a SET position = o.ord - 1
    FROM unnest(_ids) WITH ORDINALITY AS o(aid, ord)
   WHERE a.id = o.aid;
END $$;
REVOKE ALL ON FUNCTION public.academia_reorder_tier(uuid, text, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.academia_reorder_tier(uuid, text, uuid[]) TO authenticated;

COMMENT ON FUNCTION public.academia_can_manage_session(uuid) IS
  'True for the school owner or the teacher who created the session (NULL created_by is owner-only).';
COMMENT ON FUNCTION public.academia_can_manage_activity(uuid) IS
  'True for the school owner, the activity creator, or the teacher who created the parent session.';
