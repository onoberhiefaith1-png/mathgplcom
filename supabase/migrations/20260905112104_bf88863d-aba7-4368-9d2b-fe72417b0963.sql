CREATE TABLE public.building_frames (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  building_id UUID NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
  walkway_id UUID REFERENCES public.building_walkways(id) ON DELETE CASCADE,
  classroom_id UUID REFERENCES public.building_classrooms(id) ON DELETE CASCADE,
  wall TEXT NOT NULL DEFAULT 'leftWall',
  design TEXT NOT NULL DEFAULT 'courses',
  name TEXT NOT NULL DEFAULT 'New frame',
  offset_along DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  offset_y DOUBLE PRECISION NOT NULL DEFAULT 2.1,
  width DOUBLE PRECISION NOT NULL DEFAULT 1.6,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT building_frames_one_place CHECK (
    (walkway_id IS NOT NULL AND classroom_id IS NULL)
    OR (walkway_id IS NULL AND classroom_id IS NOT NULL)
  ),
  CONSTRAINT building_frames_wall CHECK (wall IN ('leftWall','rightWall','endWall'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.building_frames TO authenticated;
GRANT ALL ON public.building_frames TO service_role;

ALTER TABLE public.building_frames ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View frames of a viewable building"
ON public.building_frames FOR SELECT TO authenticated
USING (public.can_view_building(building_id));

CREATE POLICY "Editors manage frames of their building"
ON public.building_frames FOR ALL TO authenticated
USING (public.can_edit_building(building_id))
WITH CHECK (public.can_edit_building(building_id));

CREATE TRIGGER touch_building_frames
BEFORE UPDATE ON public.building_frames
FOR EACH ROW EXECUTE FUNCTION public.touch_academy_row();

CREATE INDEX building_frames_building_idx ON public.building_frames(building_id);

CREATE TABLE public.building_frame_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  frame_id UUID NOT NULL REFERENCES public.building_frames(id) ON DELETE CASCADE,
  content_kind TEXT NOT NULL,
  content_id UUID NOT NULL,
  position DOUBLE PRECISION NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT building_frame_links_kind CHECK (content_kind IN ('course','assessment','adventure','game')),
  CONSTRAINT building_frame_links_unique UNIQUE (frame_id, content_kind, content_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.building_frame_links TO authenticated;
GRANT ALL ON public.building_frame_links TO service_role;

ALTER TABLE public.building_frame_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View frame links of a viewable building"
ON public.building_frame_links FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.building_frames f
  WHERE f.id = frame_id AND public.can_view_building(f.building_id)
));

CREATE POLICY "Editors manage frame links of their building"
ON public.building_frame_links FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.building_frames f
  WHERE f.id = frame_id AND public.can_edit_building(f.building_id)
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.building_frames f
  WHERE f.id = frame_id AND public.can_edit_building(f.building_id)
));

CREATE INDEX building_frame_links_frame_idx ON public.building_frame_links(frame_id);