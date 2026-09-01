ALTER TABLE public.building_walkway_links
  ADD COLUMN IF NOT EXISTS corridor_walkway_id uuid REFERENCES public.building_walkways(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS building_walkway_links_corridor_idx
  ON public.building_walkway_links (corridor_walkway_id);