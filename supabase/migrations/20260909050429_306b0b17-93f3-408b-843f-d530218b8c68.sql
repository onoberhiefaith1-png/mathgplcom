-- Frozen copies of assigned questions.
--
-- The moment a question is handed out (Assignment, Adventure, Course/Exercise
-- Card, Assessment, Smart Card) an immutable copy of everything needed to run
-- it is stored here, so later edits or deletion of the Lesson Note can never
-- change or break work already given out.

CREATE TABLE IF NOT EXISTS public.assigned_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  -- Reference only: never read back to rebuild the question.
  source_notebook_id uuid,
  source_section_id uuid,
  source_subsection_id uuid,
  label text NOT NULL DEFAULT '',
  -- Student-safe payload: question text, floating chips, containers, marks,
  -- notes, note-only lines and table workspaces.
  question jsonb NOT NULL,
  total_marks integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assigned_questions TO authenticated;
GRANT ALL ON public.assigned_questions TO service_role;

ALTER TABLE public.assigned_questions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'assigned_questions'
      AND policyname = 'assigned_questions_owner_all'
  ) THEN
    CREATE POLICY assigned_questions_owner_all
      ON public.assigned_questions
      FOR ALL
      TO authenticated
      USING (owner_id = auth.uid())
      WITH CHECK (owner_id = auth.uid());
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS assigned_questions_owner_idx
  ON public.assigned_questions (owner_id);
CREATE INDEX IF NOT EXISTS assigned_questions_source_idx
  ON public.assigned_questions (source_subsection_id);

-- The hidden marking data. Never reachable by anon; only the owner and the
-- server-side grader can read it.
CREATE TABLE IF NOT EXISTS public.assigned_question_keys (
  assigned_question_id uuid PRIMARY KEY
    REFERENCES public.assigned_questions(id) ON DELETE CASCADE,
  lines jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assigned_question_keys TO authenticated;
GRANT ALL ON public.assigned_question_keys TO service_role;

ALTER TABLE public.assigned_question_keys ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'assigned_question_keys'
      AND policyname = 'assigned_question_keys_owner_all'
  ) THEN
    CREATE POLICY assigned_question_keys_owner_all
      ON public.assigned_question_keys
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.assigned_questions q
          WHERE q.id = assigned_question_keys.assigned_question_id
            AND q.owner_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.assigned_questions q
          WHERE q.id = assigned_question_keys.assigned_question_id
            AND q.owner_id = auth.uid()
        )
      );
  END IF;
END $$;

-- An Exercise Card question points at its own frozen copy. Deleting the link
-- (or the card, or the course) removes the copy; nothing else does.
ALTER TABLE public.course_exercise_questions
  ADD COLUMN IF NOT EXISTS assigned_question_id uuid
    REFERENCES public.assigned_questions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS course_exercise_questions_assigned_idx
  ON public.course_exercise_questions (assigned_question_id);