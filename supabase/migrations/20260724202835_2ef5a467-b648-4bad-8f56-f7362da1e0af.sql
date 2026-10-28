CREATE TABLE public.assessment_board_state (
  assessment_id uuid NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  state_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  question_id text,
  active_line_idx integer NOT NULL DEFAULT 0,
  author uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (assessment_id, student_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assessment_board_state TO authenticated;
GRANT ALL ON public.assessment_board_state TO service_role;

ALTER TABLE public.assessment_board_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students manage their own assessment board state"
ON public.assessment_board_state
FOR ALL
TO authenticated
USING (student_id = auth.uid())
WITH CHECK (student_id = auth.uid());

CREATE POLICY "Assessment owner can read student board state"
ON public.assessment_board_state
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.assessments a
  WHERE a.id = assessment_board_state.assessment_id
    AND a.owner_id = auth.uid()
));

CREATE POLICY "Assessment owner can write student board state"
ON public.assessment_board_state
FOR UPDATE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.assessments a
  WHERE a.id = assessment_board_state.assessment_id
    AND a.owner_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.assessments a
  WHERE a.id = assessment_board_state.assessment_id
    AND a.owner_id = auth.uid()
));

CREATE POLICY "Assessment owner can create student board state"
ON public.assessment_board_state
FOR INSERT
TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.assessments a
  WHERE a.id = assessment_board_state.assessment_id
    AND a.owner_id = auth.uid()
));

CREATE TRIGGER trg_assessment_board_state_updated_at
BEFORE UPDATE ON public.assessment_board_state
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();