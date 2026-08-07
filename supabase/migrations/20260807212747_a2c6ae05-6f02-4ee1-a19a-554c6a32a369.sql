ALTER TABLE public.adventure_groups
  DROP CONSTRAINT IF EXISTS adventure_groups_class_id_game_id_progress_element_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS adventure_groups_class_game_name_key
  ON public.adventure_groups (class_id, game_id, name);

CREATE UNIQUE INDEX IF NOT EXISTS adventure_groups_one_primary_key
  ON public.adventure_groups (class_id, game_id)
  WHERE is_primary;