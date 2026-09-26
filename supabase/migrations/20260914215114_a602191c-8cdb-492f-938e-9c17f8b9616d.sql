CREATE POLICY "Assigned students can view the game"
  ON public.slate_games FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.slate_game_assignments a
    WHERE a.game_id = slate_games.id
      AND a.unassigned_at IS NULL
      AND public.is_class_member(a.class_id)
  ));

CREATE POLICY "Assigned students can view the game questions"
  ON public.slate_game_questions FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.slate_game_assignments a
    WHERE a.game_id = slate_game_questions.game_id
      AND a.unassigned_at IS NULL
      AND public.is_class_member(a.class_id)
  ));