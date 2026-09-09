ALTER TABLE public.building_gallery_entries
  ADD COLUMN IF NOT EXISTS exterior_config jsonb,
  ADD COLUMN IF NOT EXISTS exterior_thumbnail text;