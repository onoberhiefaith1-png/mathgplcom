ALTER TABLE public.building_walkways
  ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT 'Hallway';

UPDATE public.building_walkways
SET name = 'Main Hallway'
WHERE parent_id IS NULL AND name = 'Hallway';