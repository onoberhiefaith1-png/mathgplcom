ALTER TABLE public.adventure_groups
  ADD COLUMN IF NOT EXISTS style_color text,
  ADD COLUMN IF NOT EXISTS style_scale numeric,
  ADD COLUMN IF NOT EXISTS style_preset_id text,
  ADD COLUMN IF NOT EXISTS qualified boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS eliminated_at_scene_id text;

ALTER TABLE public.class_games
  ADD COLUMN IF NOT EXISTS group_completion_message text,
  ADD COLUMN IF NOT EXISTS winner_group_id uuid;