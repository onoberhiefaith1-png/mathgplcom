CREATE TABLE public.slate_game_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.slate_games(id) ON DELETE CASCADE,
  assignment_id uuid REFERENCES public.slate_game_assignments(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_index integer NOT NULL DEFAULT 0,
  current_line integer NOT NULL DEFAULT 1,
  completed_question_ids text[] NOT NULL DEFAULT '{}',
  consumed_reward_keys text[] NOT NULL DEFAULT '{}',
  coins integer NOT NULL DEFAULT 0,
  lives integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'in_progress',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX slate_game_progress_unique
  ON public.slate_game_progress (game_id, student_id, coalesce(assignment_id, '00000000-0000-0000-0000-000000000000'::uuid));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.slate_game_progress TO authenticated;
GRANT ALL ON public.slate_game_progress TO service_role;

ALTER TABLE public.slate_game_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students manage own game progress"
  ON public.slate_game_progress FOR ALL TO authenticated
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "Assigning teacher reads game progress"
  ON public.slate_game_progress FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.slate_game_assignments a
    WHERE a.id = slate_game_progress.assignment_id
      AND (a.created_by = auth.uid() OR public.is_class_owner(a.class_id))
  ));

CREATE TRIGGER slate_game_progress_touch
  BEFORE UPDATE ON public.slate_game_progress
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();