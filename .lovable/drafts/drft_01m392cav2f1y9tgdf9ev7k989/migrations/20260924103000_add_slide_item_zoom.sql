ALTER TABLE public.notebook_slide_items
  ADD COLUMN IF NOT EXISTS zoom real NOT NULL DEFAULT 1.0
  CHECK (zoom >= 0.5 AND zoom <= 5.0);
