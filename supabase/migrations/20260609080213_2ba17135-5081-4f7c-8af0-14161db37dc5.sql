-- ============================================================
-- Assessment Assignment System + Floating Number Scoring
-- ============================================================

-- 1. Scoring config on subsections (label / mode / marksPerLine)
ALTER TABLE public.notebook_subsections
  ADD COLUMN IF NOT EXISTS floating_scoring jsonb;

-- ============================================================
-- 2. assessments — the assignment definition (student-safe payload)
-- ============================================================
CREATE TABLE public.assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  notebook_id uuid,
  section_id uuid,
  kind text NOT NULL DEFAULT 'classwork',
  title text NOT NULL DEFAULT 'Assignment',
  score_label text NOT NULL DEFAULT 'Marks',
  total_marks integer NOT NULL DEFAULT 0,
  questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assessments TO authenticated;
GRANT ALL ON public.assessments TO service_role;

ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;

-- Teacher (owner) can fully manage their assessments.
CREATE POLICY "Owner manages assessments"
  ON public.assessments FOR ALL
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid() AND public.is_class_owner(class_id));

-- Class members can read assessments assigned to their class.
CREATE POLICY "Members read class assessments"
  ON public.assessments FOR SELECT
  TO authenticated
  USING (public.is_class_member(class_id) OR public.is_class_owner(class_id));

CREATE TRIGGER assessments_touch_updated_at
  BEFORE UPDATE ON public.assessments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================
-- 3. assessment_answer_keys — HIDDEN correct lines (owner + service only)
-- ============================================================
CREATE TABLE public.assessment_answer_keys (
  assessment_id uuid PRIMARY KEY REFERENCES public.assessments(id) ON DELETE CASCADE,
  lines jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assessment_answer_keys TO authenticated;
GRANT ALL ON public.assessment_answer_keys TO service_role;

ALTER TABLE public.assessment_answer_keys ENABLE ROW LEVEL SECURITY;

-- Only the assessment owner may read/write the key. Students NEVER can.
CREATE POLICY "Owner manages answer keys"
  ON public.assessment_answer_keys FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.assessments a WHERE a.id = assessment_id AND a.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.assessments a WHERE a.id = assessment_id AND a.owner_id = auth.uid()));

CREATE TRIGGER answer_keys_touch_updated_at
  BEFORE UPDATE ON public.assessment_answer_keys
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================
-- 4. assessment_progress — per-student progress / score
-- ============================================================
CREATE TABLE public.assessment_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  solved_lines jsonb NOT NULL DEFAULT '{}'::jsonb,
  score integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'in_progress',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (assessment_id, student_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assessment_progress TO authenticated;
GRANT ALL ON public.assessment_progress TO service_role;

ALTER TABLE public.assessment_progress ENABLE ROW LEVEL SECURITY;

-- Students manage only their own progress row.
CREATE POLICY "Student manages own progress"
  ON public.assessment_progress FOR ALL
  TO authenticated
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

-- The assessment owner (teacher) can read all progress for their assessments.
CREATE POLICY "Owner reads assessment progress"
  ON public.assessment_progress FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.assessments a WHERE a.id = assessment_id AND a.owner_id = auth.uid()));

CREATE TRIGGER progress_touch_updated_at
  BEFORE UPDATE ON public.assessment_progress
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Live progress updates for teacher monitoring + student board.
ALTER PUBLICATION supabase_realtime ADD TABLE public.assessment_progress;

-- ============================================================
-- 5. Realtime topic authorization for assessment channels
-- ============================================================
CREATE OR REPLACE FUNCTION public.can_access_realtime_topic(_topic text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  cid uuid;
  aid uuid;
  raw text;
BEGIN
  IF uid IS NULL OR _topic IS NULL THEN
    RETURN false;
  END IF;

  -- Personal membership channel: only the owner of the topic.
  IF _topic LIKE 'member-of-%' THEN
    RETURN _topic = 'member-of-' || uid::text;
  END IF;

  -- Owner-only: join requests for a class.
  IF _topic LIKE 'join-requests-%' THEN
    raw := substring(_topic FROM length('join-requests-') + 1);
    BEGIN cid := raw::uuid; EXCEPTION WHEN others THEN RETURN false; END;
    RETURN public.is_class_owner(cid);
  END IF;

  -- Assessment progress channel: class owner or member of the assessment's class.
  IF _topic LIKE 'assessment-progress-%' THEN
    raw := substring(_topic FROM length('assessment-progress-') + 1);
    BEGIN aid := raw::uuid; EXCEPTION WHEN others THEN RETURN false; END;
    SELECT a.class_id INTO cid FROM public.assessments a WHERE a.id = aid;
    IF cid IS NULL THEN RETURN false; END IF;
    RETURN public.is_class_owner(cid) OR public.is_class_member(cid);
  END IF;

  -- Class channels: owner or member may subscribe.
  IF _topic LIKE 'sb-sync-%' THEN
    raw := substring(_topic FROM length('sb-sync-') + 1);
  ELSIF _topic LIKE 'smartboard-state-%' THEN
    raw := substring(_topic FROM length('smartboard-state-') + 1);
  ELSIF _topic LIKE 'class-visibility-%' THEN
    raw := substring(_topic FROM length('class-visibility-') + 1);
  ELSIF _topic LIKE 'class-notes-%' THEN
    raw := substring(_topic FROM length('class-notes-') + 1);
  ELSIF _topic LIKE 'active-student-members-%' THEN
    raw := substring(_topic FROM length('active-student-members-') + 1);
  ELSIF _topic LIKE 'class-assessments-%' THEN
    raw := substring(_topic FROM length('class-assessments-') + 1);
  ELSE
    RETURN false;
  END IF;

  BEGIN cid := raw::uuid; EXCEPTION WHEN others THEN RETURN false; END;
  RETURN public.is_class_owner(cid) OR public.is_class_member(cid);
END;
$function$;