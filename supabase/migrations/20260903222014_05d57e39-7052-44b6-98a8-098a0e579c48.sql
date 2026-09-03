DROP TABLE IF EXISTS public.building_door_locks;

CREATE TABLE public.building_room_locks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  building_id UUID NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
  classroom_id UUID NOT NULL UNIQUE REFERENCES public.building_classrooms(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  charset TEXT NOT NULL DEFAULT 'digits',
  code_length INTEGER NOT NULL DEFAULT 4,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT ON public.building_room_locks TO authenticated;
GRANT ALL ON public.building_room_locks TO service_role;

ALTER TABLE public.building_room_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Viewers can read lock metadata"
  ON public.building_room_locks FOR SELECT TO authenticated
  USING (public.can_view_building(building_id));

CREATE POLICY "Editors manage room locks"
  ON public.building_room_locks FOR ALL TO authenticated
  USING (public.can_edit_building(building_id))
  WITH CHECK (public.can_edit_building(building_id));

CREATE TRIGGER update_building_room_locks_updated_at
  BEFORE UPDATE ON public.building_room_locks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();