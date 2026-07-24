-- 1. Stable identity for lesson-note questions
ALTER TABLE public.notebook_sections ADD COLUMN IF NOT EXISTS stable_key uuid NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE public.notebook_subsections ADD COLUMN IF NOT EXISTS stable_key uuid NOT NULL DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX IF NOT EXISTS notebook_sections_stable_key_idx ON public.notebook_sections(stable_key);
CREATE UNIQUE INDEX IF NOT EXISTS notebook_subsections_stable_key_idx ON public.notebook_subsections(stable_key);

-- 2. Assignment rows reference the stable key
ALTER TABLE public.class_adventure_notes ADD COLUMN IF NOT EXISTS question_key uuid;
ALTER TABLE public.assessments ADD COLUMN IF NOT EXISTS question_key uuid;
ALTER TABLE public.class_game_boards ADD COLUMN IF NOT EXISTS question_keys uuid[] NOT NULL DEFAULT '{}';

UPDATE public.class_adventure_notes r
SET question_key = s.stable_key
FROM public.notebook_sections s
WHERE r.section_id = s.id AND r.question_key IS NULL;

UPDATE public.assessments a
SET question_key = s.stable_key
FROM public.notebook_sections s
WHERE a.section_id = s.id AND a.question_key IS NULL;

-- 3. Duplicates become impossible while a row is active
CREATE UNIQUE INDEX IF NOT EXISTS class_adventure_notes_active_key_idx
  ON public.class_adventure_notes(class_id, notebook_id, question_key)
  WHERE unassigned_at IS NULL AND question_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS assessments_active_question_key_idx
  ON public.assessments(class_id, notebook_id, question_key)
  WHERE unassigned_at IS NULL AND question_key IS NOT NULL AND kind <> 'adventure';

-- 4. Per-question board state (each question gets its own board)
CREATE TABLE IF NOT EXISTS public.assessment_question_board_state (
  assessment_id uuid NOT NULL,
  student_id uuid NOT NULL,
  question_id text NOT NULL,
  state_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  active_line_idx integer NOT NULL DEFAULT 0,
  author uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (assessment_id, student_id, question_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assessment_question_board_state TO authenticated;
GRANT ALL ON public.assessment_question_board_state TO service_role;

ALTER TABLE public.assessment_question_board_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students manage their own question board"
  ON public.assessment_question_board_state FOR ALL
  TO authenticated
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "Class owners read student question boards"
  ON public.assessment_question_board_state FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.assessments a
    WHERE a.id = assessment_question_board_state.assessment_id
      AND public.is_class_owner(a.class_id)
  ));

CREATE POLICY "Class owners co-edit student question boards"
  ON public.assessment_question_board_state FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.assessments a
    WHERE a.id = assessment_question_board_state.assessment_id
      AND public.is_class_owner(a.class_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.assessments a
    WHERE a.id = assessment_question_board_state.assessment_id
      AND public.is_class_owner(a.class_id)
  ));

CREATE POLICY "Class owners insert student question boards"
  ON public.assessment_question_board_state FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.assessments a
    WHERE a.id = assessment_question_board_state.assessment_id
      AND public.is_class_owner(a.class_id)
  ));

CREATE TRIGGER assessment_question_board_state_touch
  BEFORE UPDATE ON public.assessment_question_board_state
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();