-- Academia tiered evaluation (ACADEMIA_TIERED_EVALUATION_PLAN.md).
-- 1. Every activity sits in one tier batch: beginner | intermediate | expert.
--    Existing rows default to beginner. A tier never changes after assignment,
--    and reordering happens only inside one tier (academia_reorder_tier).
-- 2. Attempts are kept per learner per Session per tier, with per-activity marks.
-- 3. Teacher class assignments of a Session are recorded, so students cannot
--    cancel teacher-assigned work.
-- 4. Cancel: wipes one learner's Session attempt (all tiers), at most once per
--    learner per Session, logged for teachers. It never writes a score.
-- Idempotent: safe to apply after the matching supabase/migrations file.

-- ---------------------------------------------------------------- 1. Tiers
ALTER TABLE public.academia_activities ADD COLUMN IF NOT EXISTS tier text NOT NULL DEFAULT 'beginner';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'academia_activities_tier_check') THEN
    ALTER TABLE public.academia_activities ADD CONSTRAINT academia_activities_tier_check
      CHECK (tier IN ('beginner','intermediate','expert'));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS academia_activities_session_tier_idx
  ON public.academia_activities (session_id, tier, position);

-- Cross-tier moves are refused at the database, whatever the client sends.
CREATE OR REPLACE FUNCTION public.academia_activities_lock_tier()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.tier IS DISTINCT FROM OLD.tier THEN
    RAISE EXCEPTION 'cross_tier_move: an activity stays in the tier it was assigned to'
      USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.session_id IS DISTINCT FROM OLD.session_id THEN
    RAISE EXCEPTION 'cross_session_move: an activity stays in its Session'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.academia_activities_lock_tier() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS academia_activities_lock_tier ON public.academia_activities;
CREATE TRIGGER academia_activities_lock_tier BEFORE UPDATE OF tier, session_id ON public.academia_activities
  FOR EACH ROW EXECUTE FUNCTION public.academia_activities_lock_tier();

-- Reorder one tier batch. Every id must be in this Session and this tier, and
-- the list must cover the whole batch, so nothing can slip across tiers.
CREATE OR REPLACE FUNCTION public.academia_reorder_tier(_session uuid, _tier text, _ids uuid[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_signed_in'; END IF;
  IF _tier IS NULL OR _tier NOT IN ('beginner','intermediate','expert') THEN RAISE EXCEPTION 'bad_tier'; END IF;
  IF NOT public.academia_can_build_subject(public.academia_subject_of_session(_session)) THEN
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

-- ------------------------------------------------------- 2. Per-tier attempts
ALTER TABLE public.academia_attempts
  ADD COLUMN IF NOT EXISTS tier text NOT NULL DEFAULT 'beginner',
  ADD COLUMN IF NOT EXISTS activity_scores jsonb NOT NULL DEFAULT '{}'::jsonb;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'academia_attempts_tier_check') THEN
    ALTER TABLE public.academia_attempts ADD CONSTRAINT academia_attempts_tier_check
      CHECK (tier IN ('beginner','intermediate','expert'));
  END IF;
END $$;
ALTER TABLE public.academia_attempts DROP CONSTRAINT IF EXISTS academia_attempts_session_id_user_id_mode_key;
CREATE UNIQUE INDEX IF NOT EXISTS academia_attempts_session_user_mode_tier_key
  ON public.academia_attempts (session_id, user_id, mode, tier);

-- ---------------------------------------- 3. Teacher class assignments
CREATE TABLE IF NOT EXISTS public.academia_session_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.academia_sessions(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  assigned_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, class_id)
);
GRANT SELECT, INSERT, DELETE ON public.academia_session_assignments TO authenticated;
GRANT ALL ON public.academia_session_assignments TO service_role;
ALTER TABLE public.academia_session_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "class owners record session assignments" ON public.academia_session_assignments;
CREATE POLICY "class owners record session assignments" ON public.academia_session_assignments FOR INSERT TO authenticated
  WITH CHECK (assigned_by = auth.uid()
    AND EXISTS (SELECT 1 FROM public.classes c WHERE c.id = class_id AND c.owner_id = auth.uid()));
DROP POLICY IF EXISTS "read session assignments" ON public.academia_session_assignments;
CREATE POLICY "read session assignments" ON public.academia_session_assignments FOR SELECT TO authenticated
  USING (assigned_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.class_members m WHERE m.class_id = academia_session_assignments.class_id AND m.user_id = auth.uid())
    OR public.academia_can_build_subject(public.academia_subject_of_session(session_id)));
DROP POLICY IF EXISTS "owners remove session assignments" ON public.academia_session_assignments;
CREATE POLICY "owners remove session assignments" ON public.academia_session_assignments FOR DELETE TO authenticated
  USING (assigned_by = auth.uid());

CREATE OR REPLACE FUNCTION public.academia_session_teacher_assigned(_session uuid, _learner uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM academia_session_assignments sa
    JOIN class_members m ON m.class_id = sa.class_id
    WHERE sa.session_id = _session AND m.user_id = _learner) $$;
REVOKE ALL ON FUNCTION public.academia_session_teacher_assigned(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.academia_session_teacher_assigned(uuid, uuid) TO authenticated;

-- A teacher of this learner for this Session: subject builder, school owner, or
-- the teacher who assigned the Session into a class the learner is in.
CREATE OR REPLACE FUNCTION public.academia_is_session_teacher(_session uuid, _learner uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND (
    academia_can_build_subject(academia_subject_of_session(_session))
    OR is_org_owner(academia_org_of_session(_session))
    OR EXISTS (
      SELECT 1 FROM academia_session_assignments sa
      JOIN class_members m ON m.class_id = sa.class_id AND m.user_id = _learner
      WHERE sa.session_id = _session AND sa.assigned_by = auth.uid())) $$;
REVOKE ALL ON FUNCTION public.academia_is_session_teacher(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.academia_is_session_teacher(uuid, uuid) TO authenticated;

-- ---------------------------------------------------------------- 4. Cancel
CREATE TABLE IF NOT EXISTS public.academia_attempt_cancels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.academia_sessions(id) ON DELETE CASCADE,
  learner_id uuid NOT NULL,
  cancelled_by uuid NOT NULL,
  cancelled_by_role text NOT NULL CHECK (cancelled_by_role IN ('learner','teacher')),
  -- What was wiped (per tier/mode), so teachers can see it. Never restored.
  snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, learner_id)
);
CREATE INDEX IF NOT EXISTS academia_attempt_cancels_session_idx ON public.academia_attempt_cancels (session_id, created_at DESC);
-- Written only through academia_cancel_session_attempt.
GRANT SELECT ON public.academia_attempt_cancels TO authenticated;
GRANT ALL ON public.academia_attempt_cancels TO service_role;
ALTER TABLE public.academia_attempt_cancels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "learners and teachers read cancels" ON public.academia_attempt_cancels;
CREATE POLICY "learners and teachers read cancels" ON public.academia_attempt_cancels FOR SELECT TO authenticated
  USING (learner_id = auth.uid() OR public.academia_is_session_teacher(session_id, learner_id));

CREATE OR REPLACE FUNCTION public.academia_cancel_state(_session uuid, _learner uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_learner uuid := coalesce(_learner, auth.uid()); c record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_signed_in'; END IF;
  IF v_learner <> auth.uid() AND NOT academia_is_session_teacher(_session, v_learner) THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;
  SELECT * INTO c FROM academia_attempt_cancels WHERE session_id = _session AND learner_id = v_learner;
  RETURN jsonb_build_object(
    'caller_is_learner', v_learner = auth.uid(),
    'caller_is_teacher', academia_is_session_teacher(_session, v_learner),
    'teacher_assigned', academia_session_teacher_assigned(_session, v_learner),
    'already_cancelled', c.id IS NOT NULL,
    'cancelled_at', c.created_at,
    'cancelled_by_role', c.cancelled_by_role,
    'has_attempt', EXISTS (SELECT 1 FROM academia_attempts WHERE session_id = _session AND user_id = v_learner));
END $$;
REVOKE ALL ON FUNCTION public.academia_cancel_state(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.academia_cancel_state(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.academia_cancel_session_attempt(_session uuid, _learner uuid DEFAULT NULL, _reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_learner uuid := coalesce(_learner, auth.uid());
  v_teacher boolean;
  v_snapshot jsonb;
  v_assessments uuid[];
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'not_signed_in'; END IF;
  v_teacher := academia_is_session_teacher(_session, v_learner);
  IF v_learner <> v_caller AND NOT v_teacher THEN RAISE EXCEPTION 'not_allowed'; END IF;
  -- Students cancel self-practice only; teacher-assigned work is for teachers.
  IF NOT v_teacher AND academia_session_teacher_assigned(_session, v_learner) THEN
    RAISE EXCEPTION 'teacher_assigned';
  END IF;
  -- One cancel per learner per Session (lock the pair so two clicks can't race).
  PERFORM pg_advisory_xact_lock(hashtextextended(_session::text || ':' || v_learner::text, 0));
  IF EXISTS (SELECT 1 FROM academia_attempt_cancels WHERE session_id = _session AND learner_id = v_learner) THEN
    RAISE EXCEPTION 'already_cancelled';
  END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('mode', mode, 'tier', tier, 'score', score, 'best_score', best_score,
           'max_score', max_score, 'status', status, 'attempts', attempts) ORDER BY tier, mode), '[]'::jsonb)
    INTO v_snapshot FROM academia_attempts WHERE session_id = _session AND user_id = v_learner;
  IF v_snapshot = '[]'::jsonb THEN RAISE EXCEPTION 'nothing_to_cancel'; END IF;

  INSERT INTO academia_attempt_cancels (session_id, learner_id, cancelled_by, cancelled_by_role, snapshot, reason)
  VALUES (_session, v_learner, v_caller, CASE WHEN v_learner = v_caller AND NOT v_teacher THEN 'learner' ELSE 'teacher' END,
          v_snapshot, nullif(left(coalesce(_reason, ''), 500), ''));

  -- Wipe: the Session record (every tier/mode), the learner's marks on this
  -- Session's own Practice questions, and the resume point. No score is written.
  DELETE FROM academia_attempts WHERE session_id = _session AND user_id = v_learner;
  SELECT coalesce(array_agg(DISTINCT assessment_id), '{}') INTO v_assessments
    FROM academia_activities WHERE session_id = _session AND assessment_id IS NOT NULL;
  IF cardinality(v_assessments) > 0 THEN
    DELETE FROM assessment_progress WHERE student_id = v_learner AND assessment_id = ANY (v_assessments);
    DELETE FROM assessment_question_board_state WHERE student_id = v_learner AND assessment_id = ANY (v_assessments);
  END IF;
  DELETE FROM academia_session_positions WHERE session_id = _session AND user_id = v_learner;
  RETURN jsonb_build_object('cancelled', true, 'session_id', _session, 'learner_id', v_learner);
END $$;
REVOKE ALL ON FUNCTION public.academia_cancel_session_attempt(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.academia_cancel_session_attempt(uuid, uuid, text) TO authenticated;
