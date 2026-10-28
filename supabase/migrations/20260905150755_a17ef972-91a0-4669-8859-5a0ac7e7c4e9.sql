ALTER TABLE public.building_frames
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'frame',
  ADD COLUMN IF NOT EXISTS content_path text,
  ADD COLUMN IF NOT EXISTS height_ratio numeric NOT NULL DEFAULT 0.66,
  ADD COLUMN IF NOT EXISTS locked boolean NOT NULL DEFAULT false;

ALTER TABLE public.building_frames
  DROP CONSTRAINT IF EXISTS building_frames_kind_check;

ALTER TABLE public.building_frames
  ADD CONSTRAINT building_frames_kind_check CHECK (kind IN ('frame','window'));