CREATE TABLE public.building_classrooms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  building_id UUID NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
  door_id UUID NOT NULL UNIQUE REFERENCES public.building_doors(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'classroom',
  surface_overrides JSONB NOT NULL DEFAULT '{}'::jsonb,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT building_classrooms_kind_check CHECK (kind IN ('classroom', 'teaching_hall', 'auditorium'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.building_classrooms TO authenticated;
GRANT ALL ON public.building_classrooms TO service_role;

ALTER TABLE public.building_classrooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View classrooms of a viewable building"
ON public.building_classrooms FOR SELECT TO authenticated
USING (public.can_view_building(building_id));

CREATE POLICY "Editors manage classrooms of their building"
ON public.building_classrooms FOR ALL TO authenticated
USING (public.can_edit_building(building_id))
WITH CHECK (public.can_edit_building(building_id));

CREATE TRIGGER touch_building_classrooms
BEFORE UPDATE ON public.building_classrooms
FOR EACH ROW EXECUTE FUNCTION public.touch_academy_row();

CREATE INDEX building_classrooms_building_idx ON public.building_classrooms(building_id);

ALTER TABLE public.building_walkways
  ADD COLUMN IF NOT EXISTS surface_overrides JSONB NOT NULL DEFAULT '{}'::jsonb;