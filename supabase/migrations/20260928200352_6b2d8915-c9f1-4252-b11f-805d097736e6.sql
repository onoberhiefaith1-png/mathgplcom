ALTER TABLE public.slate_game_questions
  DROP CONSTRAINT IF EXISTS slate_game_questions_game_id_subsection_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS slate_game_questions_pool_key
  ON public.slate_game_questions (game_id, subsection_id)
  WHERE class_id IS NULL;