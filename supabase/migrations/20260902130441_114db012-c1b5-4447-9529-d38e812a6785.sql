CREATE TABLE public.building_room_screens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  building_id UUID NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
  classroom_id UUID NOT NULL UNIQUE REFERENCES public.building_classrooms(id) ON DELETE CASCADE,
  video_path TEXT,
  video_mime TEXT,
  video_name TEXT,
  camera_active BOOLEAN NOT NULL DEFAULT false,
  camera_host_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.building_room_screens TO authenticated;
GRANT ALL ON public.building_room_screens TO service_role;

ALTER TABLE public.building_room_screens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View room screens of a viewable building"
ON public.building_room_screens FOR SELECT TO authenticated
USING (public.can_view_building(building_id));

CREATE POLICY "Editors manage room screens of their building"
ON public.building_room_screens FOR ALL TO authenticated
USING (public.can_edit_building(building_id))
WITH CHECK (public.can_edit_building(building_id));

CREATE TRIGGER touch_building_room_screens
BEFORE UPDATE ON public.building_room_screens
FOR EACH ROW EXECUTE FUNCTION public.touch_academy_row();

CREATE INDEX building_room_screens_building_idx ON public.building_room_screens(building_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.building_room_screens;