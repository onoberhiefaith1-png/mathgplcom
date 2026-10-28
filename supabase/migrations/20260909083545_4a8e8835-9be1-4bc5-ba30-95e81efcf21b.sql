ALTER TABLE public.building_room_screens
  ADD COLUMN IF NOT EXISTS wall text NOT NULL DEFAULT 'endWall',
  ADD COLUMN IF NOT EXISTS offset_along double precision,
  ADD COLUMN IF NOT EXISTS offset_y double precision,
  ADD COLUMN IF NOT EXISTS width double precision,
  ADD COLUMN IF NOT EXISTS height_ratio numeric NOT NULL DEFAULT 0.5625,
  ADD COLUMN IF NOT EXISTS rotation double precision NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked boolean NOT NULL DEFAULT false;

ALTER TABLE public.building_room_screens
  ADD CONSTRAINT building_room_screens_wall
  CHECK (wall = ANY (ARRAY['leftWall'::text, 'rightWall'::text, 'endWall'::text]));

WITH ranked AS (
  SELECT id, name, building_id,
         row_number() OVER (PARTITION BY building_id, lower(name) ORDER BY created_at, id) AS rn
  FROM public.building_frames
)
UPDATE public.building_frames f
SET name = ranked.name || ' ' || ranked.rn
FROM ranked
WHERE f.id = ranked.id AND ranked.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS building_frames_name_unique
  ON public.building_frames (building_id, lower(name));