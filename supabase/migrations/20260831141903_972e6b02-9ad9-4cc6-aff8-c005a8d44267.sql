CREATE TABLE public.building_walkway_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  building_id UUID NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
  from_walkway_id UUID NOT NULL REFERENCES public.building_walkways(id) ON DELETE CASCADE,
  to_walkway_id UUID NOT NULL REFERENCES public.building_walkways(id) ON DELETE CASCADE,
  from_position NUMERIC NOT NULL DEFAULT 0.5,
  to_position NUMERIC NOT NULL DEFAULT 0.5,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT building_walkway_links_distinct CHECK (from_walkway_id <> to_walkway_id),
  CONSTRAINT building_walkway_links_unique UNIQUE (from_walkway_id, to_walkway_id)
);

CREATE INDEX building_walkway_links_building_idx ON public.building_walkway_links(building_id);
CREATE INDEX building_walkway_links_from_idx ON public.building_walkway_links(from_walkway_id);
CREATE INDEX building_walkway_links_to_idx ON public.building_walkway_links(to_walkway_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.building_walkway_links TO authenticated;
GRANT ALL ON public.building_walkway_links TO service_role;

ALTER TABLE public.building_walkway_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Viewers can read building links"
  ON public.building_walkway_links FOR SELECT
  USING (public.can_view_building(building_id));

CREATE POLICY "Editors can create building links"
  ON public.building_walkway_links FOR INSERT
  WITH CHECK (public.can_edit_building(building_id));

CREATE POLICY "Editors can update building links"
  ON public.building_walkway_links FOR UPDATE
  USING (public.can_edit_building(building_id))
  WITH CHECK (public.can_edit_building(building_id));

CREATE POLICY "Editors can delete building links"
  ON public.building_walkway_links FOR DELETE
  USING (public.can_edit_building(building_id));

CREATE TRIGGER update_building_walkway_links_updated_at
  BEFORE UPDATE ON public.building_walkway_links
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();