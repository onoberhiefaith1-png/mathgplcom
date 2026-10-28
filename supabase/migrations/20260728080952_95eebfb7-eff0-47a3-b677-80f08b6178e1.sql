DROP INDEX IF EXISTS public.learning_assignments_active_triple_idx;
CREATE UNIQUE INDEX learning_assignments_active_triple_idx
  ON public.learning_assignments (class_id, notebook_id, mode, COALESCE(game_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE status = 'active';