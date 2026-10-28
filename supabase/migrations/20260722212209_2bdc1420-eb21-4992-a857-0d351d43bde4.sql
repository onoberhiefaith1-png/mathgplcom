
-- ============================================================
-- Phase 0: Additive foundations for gameplay-feature migration
-- ============================================================

-- 1) PUBLIC WRAPPERS around existing private helpers ---------
-- These already exist in schema `private`; ported code / policies
-- reference them via `public.*`. Wrappers keep both call sites happy.
CREATE OR REPLACE FUNCTION public.is_class_owner(_class_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private
AS $$ SELECT private.is_class_owner(_class_id) $$;

CREATE OR REPLACE FUNCTION public.is_class_member(_class_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private
AS $$ SELECT private.is_class_member(_class_id) $$;

CREATE OR REPLACE FUNCTION public.shares_class_with(_other uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private
AS $$ SELECT private.shares_class_with(_other) $$;

CREATE OR REPLACE FUNCTION public.notebook_shared_to_member(_notebook_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private
AS $$ SELECT private.notebook_shared_to_member(_notebook_id) $$;

CREATE OR REPLACE FUNCTION public.can_access_realtime_topic(_topic text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private
AS $$ SELECT private.can_access_realtime_topic(_topic) $$;

REVOKE EXECUTE ON FUNCTION public.is_class_owner(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_class_member(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.shares_class_with(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.notebook_shared_to_member(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_access_realtime_topic(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_class_owner(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_class_member(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.shares_class_with(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.notebook_shared_to_member(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_access_realtime_topic(text) TO authenticated, service_role;

-- 2) ADDITIVE COLUMNS on existing tables ---------------------
ALTER TABLE public.assessments          ADD COLUMN IF NOT EXISTS assigned_at    timestamptz;
ALTER TABLE public.assessments          ADD COLUMN IF NOT EXISTS due_at         timestamptz;
ALTER TABLE public.assessments          ADD COLUMN IF NOT EXISTS unassigned_at  timestamptz;

ALTER TABLE public.assessment_progress  ADD COLUMN IF NOT EXISTS per_question   jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.class_game_boards    ADD COLUMN IF NOT EXISTS notebook_id    uuid REFERENCES public.notebooks(id) ON DELETE SET NULL;
ALTER TABLE public.class_game_boards    ADD COLUMN IF NOT EXISTS required_marks integer;
ALTER TABLE public.class_game_boards    ADD COLUMN IF NOT EXISTS section_id     uuid REFERENCES public.notebook_sections(id) ON DELETE SET NULL;

ALTER TABLE public.notebooks            ADD COLUMN IF NOT EXISTS score_label    text NOT NULL DEFAULT 'Marks';

-- 3) NEW TABLE: class_adventure_notes ------------------------
CREATE TABLE IF NOT EXISTS public.class_adventure_notes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id      uuid NOT NULL REFERENCES public.classes(id)   ON DELETE CASCADE,
  notebook_id   uuid NOT NULL REFERENCES public.notebooks(id) ON DELETE CASCADE,
  section_id    uuid,
  assigned_by   uuid NOT NULL,
  due_at        timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_id, notebook_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_adventure_notes TO authenticated;
GRANT ALL ON public.class_adventure_notes TO service_role;
ALTER TABLE public.class_adventure_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Class owner manages adventure notes"    ON public.class_adventure_notes;
DROP POLICY IF EXISTS "Class members can read adventure notes" ON public.class_adventure_notes;
CREATE POLICY "Class owner manages adventure notes"
  ON public.class_adventure_notes FOR ALL TO authenticated
  USING (public.is_class_owner(class_id))
  WITH CHECK (public.is_class_owner(class_id));
CREATE POLICY "Class members can read adventure notes"
  ON public.class_adventure_notes FOR SELECT TO authenticated
  USING (public.is_class_member(class_id) OR public.is_class_owner(class_id));

DROP TRIGGER IF EXISTS trg_class_adventure_notes_touch ON public.class_adventure_notes;
CREATE TRIGGER trg_class_adventure_notes_touch
  BEFORE UPDATE ON public.class_adventure_notes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX IF NOT EXISTS class_adventure_notes_class_idx    ON public.class_adventure_notes(class_id);
CREATE INDEX IF NOT EXISTS class_adventure_notes_notebook_idx ON public.class_adventure_notes(notebook_id);

-- 4) NEW TABLE: game_sessions --------------------------------
CREATE TABLE IF NOT EXISTS public.game_sessions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id        uuid NOT NULL REFERENCES public.games(id)   ON DELETE CASCADE,
  class_id       uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  mode           text NOT NULL DEFAULT 'class_cumulative' CHECK (mode IN ('class_cumulative','vs_time','vs_student')),
  win_threshold  numeric NOT NULL DEFAULT 100,
  segment_count  integer NOT NULL DEFAULT 10,
  time_limit_sec integer,
  status         text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','running','won','lost','ended')),
  started_at     timestamptz,
  ended_at       timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.game_sessions TO authenticated;
GRANT ALL ON public.game_sessions TO service_role;
ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Class members view sessions"   ON public.game_sessions;
DROP POLICY IF EXISTS "Class owner manages sessions" ON public.game_sessions;
CREATE POLICY "Class members view sessions" ON public.game_sessions FOR SELECT TO authenticated
  USING (public.is_class_owner(class_id) OR public.is_class_member(class_id));
CREATE POLICY "Class owner manages sessions" ON public.game_sessions FOR ALL TO authenticated
  USING (public.is_class_owner(class_id)) WITH CHECK (public.is_class_owner(class_id));

DROP TRIGGER IF EXISTS trg_game_sessions_updated ON public.game_sessions;
CREATE TRIGGER trg_game_sessions_updated BEFORE UPDATE ON public.game_sessions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 5) NEW TABLE: game_progress --------------------------------
CREATE TABLE IF NOT EXISTS public.game_progress (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  marks      numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.game_progress TO authenticated;
GRANT ALL ON public.game_progress TO service_role;
ALTER TABLE public.game_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Class members view progress"    ON public.game_progress;
DROP POLICY IF EXISTS "Students record own progress"   ON public.game_progress;
DROP POLICY IF EXISTS "Students update own progress"   ON public.game_progress;
DROP POLICY IF EXISTS "Class owner manages progress"   ON public.game_progress;
CREATE POLICY "Class members view progress" ON public.game_progress FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.game_sessions s
    WHERE s.id = session_id AND (public.is_class_owner(s.class_id) OR public.is_class_member(s.class_id))
  ));
CREATE POLICY "Students record own progress" ON public.game_progress FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND EXISTS (
    SELECT 1 FROM public.game_sessions s
    WHERE s.id = session_id AND (public.is_class_owner(s.class_id) OR public.is_class_member(s.class_id))
  ));
CREATE POLICY "Students update own progress" ON public.game_progress FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Class owner manages progress" ON public.game_progress FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.game_sessions s WHERE s.id = session_id AND public.is_class_owner(s.class_id)
  )) WITH CHECK (EXISTS (
    SELECT 1 FROM public.game_sessions s WHERE s.id = session_id AND public.is_class_owner(s.class_id)
  ));

-- 6) NEW TABLE: game_time_bars -------------------------------
CREATE TABLE IF NOT EXISTS public.game_time_bars (
  game_id                 uuid PRIMARY KEY REFERENCES public.games(id) ON DELETE CASCADE,
  progress_element_id     text NOT NULL,
  duration_seconds        integer NOT NULL DEFAULT 600,
  start_mode              text NOT NULL DEFAULT 'manual' CHECK (start_mode IN ('manual','scheduled')),
  scheduled_start_at      timestamptz,
  started_at              timestamptz,
  paused_at               timestamptz,
  accumulated_paused_ms   bigint NOT NULL DEFAULT 0,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.game_time_bars TO authenticated;
GRANT ALL ON public.game_time_bars TO service_role;
ALTER TABLE public.game_time_bars ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Game owners manage their time bar" ON public.game_time_bars;
DROP POLICY IF EXISTS "Class members read time bar"       ON public.game_time_bars;
CREATE POLICY "Game owners manage their time bar" ON public.game_time_bars FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.games g WHERE g.id = game_id AND g.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.games g WHERE g.id = game_id AND g.owner_id = auth.uid()));
CREATE POLICY "Class members read time bar" ON public.game_time_bars FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.class_games cg
    WHERE cg.game_id = game_time_bars.game_id
      AND (public.is_class_owner(cg.class_id) OR public.is_class_member(cg.class_id))
  ));

DROP TRIGGER IF EXISTS game_time_bars_touch_updated_at ON public.game_time_bars;
CREATE TRIGGER game_time_bars_touch_updated_at BEFORE UPDATE ON public.game_time_bars
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 7) NEW TABLE: adventure_live_sessions ----------------------
CREATE TABLE IF NOT EXISTS public.adventure_live_sessions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id       uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  game_id        uuid NOT NULL REFERENCES public.games(id)   ON DELETE CASCADE,
  assessment_id  uuid NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  question_id    text,
  student_id     uuid NOT NULL,
  last_seen_at   timestamptz NOT NULL DEFAULT now(),
  is_active      boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_id, game_id, assessment_id, student_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.adventure_live_sessions TO authenticated;
GRANT ALL ON public.adventure_live_sessions TO service_role;
ALTER TABLE public.adventure_live_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students can view own adventure sessions"    ON public.adventure_live_sessions;
DROP POLICY IF EXISTS "Teachers can view class adventure sessions"  ON public.adventure_live_sessions;
DROP POLICY IF EXISTS "Students can create own adventure sessions"  ON public.adventure_live_sessions;
DROP POLICY IF EXISTS "Students can refresh own adventure sessions" ON public.adventure_live_sessions;
DROP POLICY IF EXISTS "Students can remove own adventure sessions"  ON public.adventure_live_sessions;
CREATE POLICY "Students can view own adventure sessions"
  ON public.adventure_live_sessions FOR SELECT TO authenticated
  USING (student_id = auth.uid());
CREATE POLICY "Teachers can view class adventure sessions"
  ON public.adventure_live_sessions FOR SELECT TO authenticated
  USING (public.is_class_owner(class_id));
CREATE POLICY "Students can create own adventure sessions"
  ON public.adventure_live_sessions FOR INSERT TO authenticated
  WITH CHECK (
    student_id = auth.uid()
    AND public.is_class_member(class_id)
    AND EXISTS (
      SELECT 1 FROM public.class_game_boards cgb
      WHERE cgb.class_id = adventure_live_sessions.class_id
        AND cgb.game_id  = adventure_live_sessions.game_id
        AND cgb.assessment_id = adventure_live_sessions.assessment_id
    )
  );
CREATE POLICY "Students can refresh own adventure sessions"
  ON public.adventure_live_sessions FOR UPDATE TO authenticated
  USING (student_id = auth.uid() AND public.is_class_member(class_id))
  WITH CHECK (student_id = auth.uid() AND public.is_class_member(class_id));
CREATE POLICY "Students can remove own adventure sessions"
  ON public.adventure_live_sessions FOR DELETE TO authenticated
  USING (student_id = auth.uid());

DROP TRIGGER IF EXISTS touch_adventure_live_sessions_updated_at ON public.adventure_live_sessions;
CREATE TRIGGER touch_adventure_live_sessions_updated_at
  BEFORE UPDATE ON public.adventure_live_sessions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS adventure_live_sessions_class_game_seen_idx
  ON public.adventure_live_sessions (class_id, game_id, last_seen_at DESC)
  WHERE is_active = true;

-- 8) HELPER: ensure_class_game_boards ------------------------
CREATE OR REPLACE FUNCTION public.ensure_class_game_boards(_game_id uuid, _class_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT (public.is_class_owner(_class_id) OR public.is_class_member(_class_id)) THEN
    RAISE EXCEPTION 'not_class_member';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.class_games WHERE class_id = _class_id AND game_id = _game_id) THEN
    RAISE EXCEPTION 'game_not_linked_to_class';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.games WHERE id = _game_id) THEN
    RAISE EXCEPTION 'game_not_found';
  END IF;
  RETURN;
END $$;
REVOKE EXECUTE ON FUNCTION public.ensure_class_game_boards(uuid, uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.ensure_class_game_boards(uuid, uuid) TO authenticated;

-- 9) REALTIME publication (idempotent) -----------------------
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'assessment_progress',
    'class_members',
    'games',
    'class_game_boards',
    'class_games',
    'class_adventure_notes',
    'assessments',
    'game_time_bars',
    'adventure_live_sessions',
    'game_sessions',
    'game_progress'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
