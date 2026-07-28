ALTER TABLE public.adventure_groups
  ADD COLUMN IF NOT EXISTS source_element_id text,
  ADD COLUMN IF NOT EXISTS is_primary boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS position_x double precision,
  ADD COLUMN IF NOT EXISTS position_y double precision;