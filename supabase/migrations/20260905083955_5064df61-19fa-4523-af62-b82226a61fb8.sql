-- Speed Performance reporting layer.
-- Reads the existing timer data (assessment_timer_attempts, guest_question_times).
-- Nothing about how attempts are recorded changes here.

-- 1. Record history: one row each time an overall record for a question is beaten.
CREATE TABLE IF NOT EXISTS public.speed_record_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  question_id text NOT NULL,
  holder_id uuid,
  holder_kind text NOT NULL DEFAULT 'student',
  best_ms bigint NOT NULL,
  set_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.speed_record_history TO authenticated;
GRANT ALL ON public.speed_record_history TO service_role;

ALTER TABLE public.speed_record_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Class owners read record history" ON public.speed_record_history;
CREATE POLICY "Class owners read record history"
  ON public.speed_record_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.assessments a
       WHERE a.id = speed_record_history.assessment_id
         AND public.is_class_owner(a.class_id)
    )
  );

CREATE INDEX IF NOT EXISTS speed_record_history_question_idx
  ON public.speed_record_history (assessment_id, question_id, set_at DESC);

-- 2. Append to history only when a successful attempt beats the current record.
CREATE OR REPLACE FUNCTION public.speed_capture_record()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_best bigint;
  holder uuid;
  kind text;
BEGIN
  IF NOT COALESCE(NEW.success, false) OR COALESCE(NEW.elapsed_ms, 0) <= 0 THEN
    RETURN NEW;
  END IF;

  SELECT min(h.best_ms) INTO current_best
    FROM public.speed_record_history h
   WHERE h.assessment_id = NEW.assessment_id
     AND h.question_id = NEW.question_id;

  IF current_best IS NOT NULL AND NEW.elapsed_ms >= current_best THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'assessment_timer_attempts' THEN
    holder := NEW.student_id;
    kind := 'student';
  ELSE
    holder := NULL;
    kind := 'guest';
  END IF;

  INSERT INTO public.speed_record_history (assessment_id, question_id, holder_id, holder_kind, best_ms)
  VALUES (NEW.assessment_id, NEW.question_id, holder, kind, NEW.elapsed_ms);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS speed_capture_record_attempts ON public.assessment_timer_attempts;
CREATE TRIGGER speed_capture_record_attempts
  AFTER INSERT OR UPDATE OF elapsed_ms, success ON public.assessment_timer_attempts
  FOR EACH ROW EXECUTE FUNCTION public.speed_capture_record();

DROP TRIGGER IF EXISTS speed_capture_record_guests ON public.guest_question_times;
CREATE TRIGGER speed_capture_record_guests
  AFTER INSERT OR UPDATE OF elapsed_ms, success ON public.guest_question_times
  FOR EACH ROW EXECUTE FUNCTION public.speed_capture_record();

-- Backfill history from the attempts already stored, oldest first, so the
-- record timeline reflects existing data.
INSERT INTO public.speed_record_history (assessment_id, question_id, holder_id, holder_kind, best_ms, set_at)
SELECT s.assessment_id, s.question_id, s.holder_id, s.holder_kind, s.elapsed_ms, s.at
  FROM (
    SELECT assessment_id, question_id, elapsed_ms,
           student_id AS holder_id, 'student'::text AS holder_kind,
           COALESCE(completed_at, updated_at, created_at) AS at,
           min(elapsed_ms) OVER (
             PARTITION BY assessment_id, question_id
             ORDER BY COALESCE(completed_at, updated_at, created_at)
             ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
           ) AS prev_best
      FROM public.assessment_timer_attempts
     WHERE success AND elapsed_ms > 0
    UNION ALL
    SELECT assessment_id, question_id, elapsed_ms,
           NULL::uuid, 'guest'::text,
           COALESCE(updated_at, created_at) AS at,
           min(elapsed_ms) OVER (
             PARTITION BY assessment_id, question_id
             ORDER BY COALESCE(updated_at, created_at)
             ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
           ) AS prev_best
      FROM public.guest_question_times
     WHERE success AND elapsed_ms > 0
  ) s
 WHERE (s.prev_best IS NULL OR s.elapsed_ms < s.prev_best)
   AND NOT EXISTS (SELECT 1 FROM public.speed_record_history);

-- 3. Student view: own best + anonymous overall best. No identities returned.
CREATE OR REPLACE FUNCTION public.speed_performance_student(_class_id uuid)
RETURNS TABLE(
  assessment_id uuid,
  question_id text,
  assignment_title text,
  question_label text,
  my_best_ms bigint,
  overall_best_ms bigint,
  i_hold_record boolean
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH mine AS (
    SELECT a.assessment_id, a.question_id, min(a.elapsed_ms) AS ms
      FROM public.assessment_timer_attempts a
      JOIN public.assessments s ON s.id = a.assessment_id
     WHERE s.class_id = _class_id
       AND a.student_id = auth.uid()
       AND a.success AND a.elapsed_ms > 0
     GROUP BY a.assessment_id, a.question_id
  ),
  overall AS (
    SELECT t.assessment_id, t.question_id, min(t.ms) AS ms FROM (
      SELECT a.assessment_id, a.question_id, a.elapsed_ms AS ms
        FROM public.assessment_timer_attempts a
        JOIN public.assessments s ON s.id = a.assessment_id
       WHERE s.class_id = _class_id AND a.success AND a.elapsed_ms > 0
      UNION ALL
      SELECT g.assessment_id, g.question_id, g.elapsed_ms
        FROM public.guest_question_times g
        JOIN public.assessments s ON s.id = g.assessment_id
       WHERE s.class_id = _class_id AND g.success AND g.elapsed_ms > 0
    ) t
    GROUP BY t.assessment_id, t.question_id
  )
  SELECT
    m.assessment_id,
    m.question_id,
    COALESCE(NULLIF(btrim(s.title), ''), NULLIF(btrim(n.title), ''), 'Assignment') AS assignment_title,
    COALESCE(NULLIF(btrim(q.label), ''), 'Question') AS question_label,
    m.ms AS my_best_ms,
    o.ms AS overall_best_ms,
    (o.ms IS NOT NULL AND m.ms <= o.ms) AS i_hold_record
  FROM mine m
  JOIN public.assessments s ON s.id = m.assessment_id
  LEFT JOIN public.notebooks n ON n.id = s.notebook_id
  LEFT JOIN overall o ON o.assessment_id = m.assessment_id AND o.question_id = m.question_id
  LEFT JOIN LATERAL (
    SELECT COALESCE(e.value ->> 'title', 'Question ' || (e.ordinality)::text) AS label
      FROM jsonb_array_elements(COALESCE(s.questions, '[]'::jsonb)) WITH ORDINALITY e(value, ordinality)
     WHERE e.value ->> 'id' = m.question_id
     LIMIT 1
  ) q ON true
  WHERE public.is_class_member(_class_id) OR public.is_class_owner(_class_id)
  ORDER BY assignment_title, question_label;
$$;

GRANT EXECUTE ON FUNCTION public.speed_performance_student(uuid) TO authenticated;

-- 4. Teacher view: every student's best time per question, plus the record holder.
CREATE OR REPLACE FUNCTION public.speed_performance_teacher(_class_id uuid, _notebook_id uuid DEFAULT NULL)
RETURNS TABLE(
  assessment_id uuid,
  notebook_id uuid,
  question_id text,
  assignment_title text,
  question_label text,
  student_id uuid,
  student_best_ms bigint,
  overall_best_ms bigint,
  holder_id uuid,
  holder_kind text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH scoped AS (
    SELECT s.* FROM public.assessments s
     WHERE s.class_id = _class_id
       AND (_notebook_id IS NULL OR s.notebook_id = _notebook_id)
  ),
  bests AS (
    SELECT a.assessment_id, a.question_id, a.student_id, min(a.elapsed_ms) AS ms
      FROM public.assessment_timer_attempts a
      JOIN scoped s ON s.id = a.assessment_id
     WHERE a.success AND a.elapsed_ms > 0
     GROUP BY a.assessment_id, a.question_id, a.student_id
  ),
  guest_best AS (
    SELECT g.assessment_id, g.question_id, min(g.elapsed_ms) AS ms
      FROM public.guest_question_times g
      JOIN scoped s ON s.id = g.assessment_id
     WHERE g.success AND g.elapsed_ms > 0
     GROUP BY g.assessment_id, g.question_id
  ),
  overall AS (
    SELECT COALESCE(b.assessment_id, gb.assessment_id) AS assessment_id,
           COALESCE(b.question_id, gb.question_id) AS question_id,
           LEAST(COALESCE(b.ms, gb.ms), COALESCE(gb.ms, b.ms)) AS ms,
           CASE WHEN gb.ms IS NOT NULL AND (b.ms IS NULL OR gb.ms < b.ms) THEN 'guest' ELSE 'student' END AS kind
      FROM (SELECT assessment_id, question_id, min(ms) AS ms FROM bests GROUP BY assessment_id, question_id) b
      FULL JOIN guest_best gb
        ON gb.assessment_id = b.assessment_id AND gb.question_id = b.question_id
  )
  SELECT
    b.assessment_id,
    s.notebook_id,
    b.question_id,
    COALESCE(NULLIF(btrim(s.title), ''), NULLIF(btrim(n.title), ''), 'Assignment') AS assignment_title,
    COALESCE(NULLIF(btrim(q.label), ''), 'Question') AS question_label,
    b.student_id,
    b.ms AS student_best_ms,
    o.ms AS overall_best_ms,
    CASE WHEN o.kind = 'student' THEN (
      SELECT bb.student_id FROM bests bb
       WHERE bb.assessment_id = b.assessment_id AND bb.question_id = b.question_id
       ORDER BY bb.ms ASC LIMIT 1
    ) END AS holder_id,
    o.kind AS holder_kind
  FROM bests b
  JOIN scoped s ON s.id = b.assessment_id
  LEFT JOIN public.notebooks n ON n.id = s.notebook_id
  LEFT JOIN overall o ON o.assessment_id = b.assessment_id AND o.question_id = b.question_id
  LEFT JOIN LATERAL (
    SELECT COALESCE(e.value ->> 'title', 'Question ' || (e.ordinality)::text) AS label
      FROM jsonb_array_elements(COALESCE(s.questions, '[]'::jsonb)) WITH ORDINALITY e(value, ordinality)
     WHERE e.value ->> 'id' = b.question_id
     LIMIT 1
  ) q ON true
  WHERE public.is_class_owner(_class_id)
  ORDER BY assignment_title, question_label, b.ms ASC;
$$;

GRANT EXECUTE ON FUNCTION public.speed_performance_teacher(uuid, uuid) TO authenticated;

-- 5. Records currently held per student — foundation for rewards later.
CREATE OR REPLACE FUNCTION public.speed_records_held(_class_id uuid)
RETURNS TABLE(student_id uuid, records_held bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH bests AS (
    SELECT a.assessment_id, a.question_id, a.student_id, min(a.elapsed_ms) AS ms
      FROM public.assessment_timer_attempts a
      JOIN public.assessments s ON s.id = a.assessment_id
     WHERE s.class_id = _class_id AND a.success AND a.elapsed_ms > 0
     GROUP BY a.assessment_id, a.question_id, a.student_id
  ),
  holders AS (
    SELECT DISTINCT ON (assessment_id, question_id) assessment_id, question_id, student_id
      FROM bests
     ORDER BY assessment_id, question_id, ms ASC
  )
  SELECT h.student_id, count(*) AS records_held
    FROM holders h
   WHERE public.is_class_owner(_class_id)
   GROUP BY h.student_id
   ORDER BY records_held DESC;
$$;

GRANT EXECUTE ON FUNCTION public.speed_records_held(uuid) TO authenticated;