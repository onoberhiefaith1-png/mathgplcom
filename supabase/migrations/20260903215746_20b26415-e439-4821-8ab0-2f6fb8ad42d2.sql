CREATE TABLE public.building_door_locks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  building_id UUID NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
  door_id UUID NOT NULL UNIQUE REFERENCES public.building_doors(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  charset TEXT NOT NULL DEFAULT 'digits',
  code_length INTEGER NOT NULL DEFAULT 4,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- The secret hash is never readable from the client: only the lock's shape is.
GRANT SELECT (id, building_id, door_id, charset, code_length, created_at, updated_at)
ON public.building_door_locks TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.building_door_locks TO authenticated;
GRANT ALL ON public.building_door_locks TO service_role;

ALTER TABLE public.building_door_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View door locks of a viewable building"
ON public.building_door_locks FOR SELECT TO authenticated
USING (public.can_view_building(building_id));

CREATE POLICY "Editors manage door locks of their building"
ON public.building_door_locks FOR ALL TO authenticated
USING (public.can_edit_building(building_id))
WITH CHECK (public.can_edit_building(building_id));

CREATE TRIGGER touch_building_door_locks
BEFORE UPDATE ON public.building_door_locks
FOR EACH ROW EXECUTE FUNCTION public.touch_academy_row();

CREATE INDEX building_door_locks_building_idx ON public.building_door_locks(building_id);