GRANT SELECT ON public.games TO authenticated;

CREATE POLICY "Class members can read linked games"
  ON public.games
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.class_game_boards b
      WHERE b.game_id = games.id
        AND (public.is_class_member(b.class_id) OR public.is_class_owner(b.class_id))
    )
    OR EXISTS (
      SELECT 1 FROM public.class_games cg
      WHERE cg.game_id = games.id
        AND (public.is_class_member(cg.class_id) OR public.is_class_owner(cg.class_id))
    )
  );