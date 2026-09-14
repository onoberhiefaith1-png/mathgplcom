CREATE TABLE public.slate_game_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES public.slate_games(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  created_by UUID NOT NULL DEFAULT auth.uid(),
  pass_percentage INTEGER NOT NULL DEFAULT 70 CHECK (pass_percentage >= 0 AND pass_percentage <= 100),
  title TEXT,
  unassigned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (game_id, class_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.slate_game_assignments TO authenticated;
GRANT ALL ON public.slate_game_assignments TO service_role;
ALTER TABLE public.slate_game_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers manage game assignments for their classes"
  ON public.slate_game_assignments FOR ALL TO authenticated
  USING (public.is_class_owner(class_id) OR created_by = auth.uid())
  WITH CHECK (public.is_class_owner(class_id) OR created_by = auth.uid());

CREATE POLICY "Class members read their game assignments"
  ON public.slate_game_assignments FOR SELECT TO authenticated
  USING (public.is_class_member(class_id));

CREATE TABLE public.slate_game_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assignment_id UUID NOT NULL REFERENCES public.slate_game_assignments(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.slate_game_questions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  marks_earned NUMERIC NOT NULL DEFAULT 0,
  marks_total NUMERIC NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (assignment_id, question_id, student_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.slate_game_results TO authenticated;
GRANT ALL ON public.slate_game_results TO service_role;
ALTER TABLE public.slate_game_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students manage their own game results"
  ON public.slate_game_results FOR ALL TO authenticated
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "Teachers read results for their class assignments"
  ON public.slate_game_results FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.slate_game_assignments a
    WHERE a.id = assignment_id AND (public.is_class_owner(a.class_id) OR a.created_by = auth.uid())
  ));

CREATE INDEX slate_game_assignments_class_idx ON public.slate_game_assignments(class_id);
CREATE INDEX slate_game_results_assignment_idx ON public.slate_game_results(assignment_id);
CREATE INDEX slate_game_results_student_idx ON public.slate_game_results(student_id);

CREATE TRIGGER slate_game_assignments_touch BEFORE UPDATE ON public.slate_game_assignments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER slate_game_results_touch BEFORE UPDATE ON public.slate_game_results
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();