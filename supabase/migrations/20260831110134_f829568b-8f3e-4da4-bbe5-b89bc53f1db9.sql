ALTER TABLE public.building_walkways
  ADD COLUMN IF NOT EXISTS junction_at numeric NOT NULL DEFAULT 0.5;