ALTER TABLE public.building_room_locks
  ADD COLUMN IF NOT EXISTS max_attempts integer,
  ADD COLUMN IF NOT EXISTS retry_after_minutes integer;

CREATE TABLE IF NOT EXISTS public.building_room_lock_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id uuid NOT NULL REFERENCES public.building_classrooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  failed_count integer NOT NULL DEFAULT 0,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (classroom_id, user_id)
);

GRANT SELECT ON public.building_room_lock_attempts TO authenticated;
GRANT ALL ON public.building_room_lock_attempts TO service_role;

ALTER TABLE public.building_room_lock_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can see their own lock attempts"
ON public.building_room_lock_attempts
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE TRIGGER touch_building_room_lock_attempts
BEFORE UPDATE ON public.building_room_lock_attempts
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();