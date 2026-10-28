DROP POLICY IF EXISTS "Class members view progress" ON public.game_progress;

CREATE POLICY "Class members view own progress"
ON public.game_progress
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.game_sessions s
    WHERE s.id = game_progress.session_id
      AND (
        public.is_class_owner(s.class_id)
        OR (public.is_class_member(s.class_id) AND game_progress.user_id = auth.uid())
      )
  )
);